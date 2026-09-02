# OpenComputer PR review agent

This example reviews GitHub pull requests with an OpenComputer Serverless
Agent. Given a PR reference, the agent fetches the metadata and diff through a
managed GitHub connection, reviews the change for correctness, and — only when
asked to — posts the result as a `COMMENT` review with inline comments.

The agent has exactly three capabilities, all defined in this repository. It
cannot approve or request changes, merge, push, or reach any host other than
`api.github.com` under `/repos/`. The GitHub token is attached by the
platform at its outbound edge and never enters the agent runtime.

[Docs walkthrough](https://docs.opencomputer.dev/agents/examples/pr-review) ·
[Serverless Agents overview](https://docs.opencomputer.dev/agents/overview)

[Deploy to OpenComputer →](https://app.opencomputer.dev/new?repository-url=https%3A%2F%2Fgithub.com%2Fdiggerhq%2Fopencomputer-example-pr-review)

## How it works

```text
"Review acme/widgets#42"            (session, playground, or webhook)
  -> agent render: instructions + tool selection for this input
  -> get_pull_request, get_diff     (managed connection, GET)
  -> review as session output       (default: dry run)
  -> post_review                    (only when the request says to post)
```

**`opencomputer/agents/pr-review/agent.ts`** — the
[agent function](https://docs.opencomputer.dev/agents/reactive-agents). Not a
loop: a synchronous render, called before every model step, that reads the
current input and selects the instructions and tool set for that step:

```tsx
export default function Agent() {
  const input = useInput();
  const live = /\bpost\b.*\breview\b/i.test(input.text ?? "");

  useModel("anthropic/claude-sonnet-4.6");
  useTool(getPullRequest);
  useTool(getDiff);
  if (live) {
    useTool(postReview);
  }
  // returns the review instructions for this render
}
```

There is no separate permission layer: dry-run-by-default is one `if`
statement. A tool the render does not select does not exist for that model
step — the runtime removes it from the toolset, so input text cannot enable
posting.

**`opencomputer/agents/pr-review/tools/github-tools.ts`** — one declared
HTTP connection and the three typed [tools](https://docs.opencomputer.dev/agents/tools) that use it. The connection
defines all outbound access:

```tsx
export const github = defineConnection({
  id: "github-api",
  origin: "https://api.github.com",
  methods: ["GET", "POST"],
  pathPrefix: "/repos/",
  headers: {
    Authorization: bearer(useSecret("GITHUB_TOKEN")),
    "User-Agent": "opencomputer-pr-review-agent",
  },
});
```

Tools call `github.fetch("/repos/…")`; the platform validates origin,
method, and path prefix, then attaches the secret at its outbound edge. The
token never enters the agent runtime. `get_pull_request` and `get_diff`
read; `post_review` writes one `COMMENT` review and falls back to a
summary-only review when GitHub rejects an inline anchor.

**The managed runtime** provides the rest: the durable session and turn
queue, the model/tool loop that calls the render
before each step, and immutable content-addressed deployments —
`npm run deploy -- --watch` publishes one per save and advances the
Development alias, while running sessions stay pinned to the
[deployment](https://docs.opencomputer.dev/agents/deployments) they started on.

## Prerequisites

- Node.js 22 or newer
- An OpenComputer account
- A GitHub fine-grained personal access token scoped to the repositories the
  agent should review, with **Pull requests: read and write** and
  **Contents: read**

## 1. Run the agent in Development

```bash
npm install
npm run opencomputer -- login
npm run deploy -- --watch
```

The first watched deployment links or creates the OpenComputer project and
prints its dashboard URL. Keep it running while developing; saving a file
deploys to Development.

## 2. Configure the GitHub token

```bash
npm run opencomputer -- secrets set GITHUB_TOKEN
```

The CLI reads the value from a hidden prompt and stores it as a
[managed secret](https://docs.opencomputer.dev/agents/secrets) allowed only for
`https://api.github.com`. The platform validates origin, method, and path
prefix before attaching the token to an outbound request; a request the
connection does not declare is rejected before it leaves.

The agent's repository access equals the token's fine-grained grant: it can
read and review only the repositories selected when the token was created.

## 3. Review a pull request

```bash
npm run session -- "Review acme/widgets#42"
```

This repository includes a fixture app (`fixture/`, a small Express orders
API) and seeded pull requests that change it, each with planted bugs. Try
one:

```bash
npm run session -- "Review diggerhq/opencomputer-example-pr-review#2"
```

The default is a dry run: the review — a verdict paragraph plus numbered
findings anchored to files and lines from the diff — is session output, and
nothing is posted to GitHub.

## 4. Post a review

```bash
npm run session -- "Review acme/widgets#42 and post the review on the PR."
```

With an explicit ask to post, the render attaches `post_review` and the agent
submits one `COMMENT` review: the verdict and findings as the body, plus
inline comments for findings it can anchor to new-side diff lines. Inline
anchors rejected by GitHub fall back to a summary-only review.

## 5. Trigger from another system

Create a stable authenticated ingress for the agent — an
[agent webhook](https://docs.opencomputer.dev/agents/webhooks):

```bash
npm run opencomputer -- webhooks create pr-review-ingress \
  --agent current \
  --environment development
```

The command prints the invocation URL and bearer token once. Each delivery
starts a fresh durable session against the active Development deployment:

```bash
curl -X POST '<webhook url>' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: <delivery id>' \
  -d '{"text": "Review acme/widgets#42"}'
```

The response is HTTP 202 with the session URL; the review proceeds
asynchronously. Retrying with the same idempotency key returns the original
session instead of starting a second review.

GitHub cannot call this URL directly — GitHub webhooks sign with an HMAC
header and cannot send a bearer token. Reviewing PRs on open requires a
relay, for example a GitHub Actions `pull_request` job that holds the
webhook URL and token as repository secrets.

## Repository layout

- `opencomputer/agents/pr-review/agent.ts` — the render function: model,
  instructions, and per-input tool selection.
- `opencomputer/agents/pr-review/tools/github-tools.ts` — the GitHub
  connection and all three tools in one module. The compiler bundles each
  tool file standalone and supports no relative imports besides
  `@opencomputer/agent`, so the connection and its tools live together, and
  `agent.ts` imports the module with an explicit `.js` suffix.
- `test/github-tools.test.ts` — unit tests for error attribution and the
  tool input schemas.
- `fixture/` — the orders API the seeded pull requests change; a stable
  review target for trying the agent.

## Develop and verify

```bash
npm run build   # type-check
npm test
```

## Current limits

- Diffs are truncated at 150,000 characters; the tool result says so and
  reports the full size.
- Reviews are `COMMENT` events only. Approval and request-changes are
  deliberately out of scope.
- One PR per request. Multi-PR sweeps and re-review on push are not built.
- GitHub-signed webhook ingress needs the relay described above.

## Development log

This example was built against the live platform as a first-user exercise.
[DX-NOTES.md](DX-NOTES.md) records every friction point, bug, and verified
behavior encountered along the way, in order.

## License

MIT
