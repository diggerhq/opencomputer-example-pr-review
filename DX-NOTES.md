# DX notes

Append-only log of developer-experience observations while building this agent
against the live product, written as a new user following only the public docs
(docs.opencomputer.dev, "Serverless Agents" tab). Newest entries last.

Entry format: date — step — what happened — exact repro — classification
(`friction` / `gap` / `bug` / `docs` / `nice`).

---

## 001 — init-clobbers-readme (bug)

2026-08-24 — step 2 (scaffold). `npx @opencomputer/cli init .` silently
**overwrote the existing committed `README.md`** with the hello-world README.
No prompt, no warning, no mention in the command output. A brand-new user's
most common flow — create the repo on GitHub with a README, clone, `init .` —
loses their file (unrecoverably, if they hadn't committed yet).

Repro: non-empty directory containing a `README.md` → `npx @opencomputer/cli init .`
→ README replaced. The quickstart says to use `.` for "an empty current
directory", but the CLI neither checks emptiness nor skips/merges existing
files. Expected: refuse, prompt, or at minimum skip files that already exist.
(It did leave `DX-NOTES.md` alone, so it only fights over the names it
generates — which is exactly the dangerous case.)

## 002 — package-name-mismatch (friction, minor)

2026-08-24 — step 2 (scaffold). `opencomputer/project.ts` correctly inferred
`name: "opencomputer-example-pr-review"` from the directory, but
`package.json` came out hardcoded as `"opencomputer-app-hello-world"`. Every
project scaffolded with `init .` gets the same npm package name. Cosmetic,
but it's the first file a user opens.

## 003 — init-output-nice (nice)

2026-08-24 — step 2 (scaffold). The scaffold itself is pleasantly minimal:
four files, an agent that is genuinely three lines, `.env.example` that
teaches the secrets model in two comment lines, and a `.gitignore` that
already covers `.opencomputer/` and `.env.local`. "Project: choose or create
one on the first watched deployment" defers cloud coupling until deploy —
`init` works fully offline.

## 004 — first-deploy-requires-watch (gap)

2026-08-24 — step 3 (first deploy). There is no one-shot first deploy:
`opencomputer deploy --create-project pr-review-agent` fails with
`--project and --create-project require --watch`. The only way to create or
select a cloud project is to start the long-running watcher (or answer an
interactive prompt). Fine on a laptop, a wall for CI — a fresh clone cannot
`deploy` non-interactively until someone has run `deploy --watch` once and
committed nothing (the binding lands in gitignored `.opencomputer/`). CI is
exactly where `deploy --alias production` should live.

## 005 — agent-identity-remap (gap)

2026-08-24 — step 3 (first deploy). `project.ts` declares
`agents: ["hello-world"]`, but the cloud says `Agents pr-review-agent@development`
— the dashboard, `opencomputer agents`, and session output all show an agent
named after the *project*, and `hello-world` appears nowhere. The CLI maps the
first local agent to the project's own agent id and would name a second agent
`pr-review-agent--<localId>` (`cloudAgentId()` in `cli/src/dev.ts`). So the
identity I wrote in source is not the identity I operate. Confusing on day
one; actively misleading in a multi-agent project or after renaming a local
agent (which silently re-targets the same cloud agent).

## 006 — first-session-e2e (nice)

2026-08-24 — step 3. `init` → `deploy --watch --create-project` →
"Deployment ready" took under 20 seconds, with project id, content-addressed
deployment digest, and dashboard URL printed. `npm run session -- "Say hi in
exactly five words."` answered correctly on the first try. Zero config beyond
login. This loop is genuinely good.

## 007 — rename-is-a-noop (confirms 005)

2026-08-24 — after step 3. Renamed the local agent `hello-world` →
`pr-review` (directory + `project.ts`). The running watcher reported
`Change detected … ✓ Development is already up to date.` — a byte-identical
artifact. The local agent id is not part of the deployment digest or any
cloud identity; only file contents count, and the first agent's name is
discarded entirely. Consistent, but it means `project.ts` agent names are
pure local bookkeeping, which nothing in the docs says.

## 008 — unauth-connection-works (nice, probe)

2026-08-24 — step 4 (read tools). `defineConnection` with **no `headers`** is
accepted and outbound requests flow — an unauthenticated connection to
`https://api.github.com` for public-repo reads works. Per-request headers on
`connection.fetch(path, { headers: { Accept: "application/vnd.github.diff" } })`
are honored (the diff media type came back). Neither behavior is documented:
secrets.mdx only shows the authenticated form, and nothing says whether
`RequestInit` headers pass through or which ones the egress filter would
strip. Both worked; both deserve a sentence in the docs.

## 009 — tool-activity-invisible-in-cli (friction)

2026-08-24 — step 4. `npm run session -- "Review diggerhq/digger#2701"`
prints only the final answer. Nothing shows whether `get_pull_request` /
`get_diff` actually ran, how long they took, or what they returned — I had to
verify the review against the real PR to rule out hallucination. The
information exists (`session inspect`, `logs`, dashboard), but the
development-loop default gives no sign of tool activity. A one-line
`→ get_diff …` trace in session output would close it.

## 010 — first-real-review-quality (nice)

2026-08-24 — step 4. First attempt at a real task: the dry-run review of
diggerhq/digger#2701 was substantive and grounded — it caught a GORM
`Save`-vs-`Updates` overwrite risk and a missing-migration question, both
real, both anchored to actual diff content. Model: claude-sonnet-4.6, stock
instructions, no examples. The product's core loop delivers.

## 011 — builtin-tools-ambient (gap, security)

2026-08-24 — step 5-6 probing. The runtime ships a full ambient toolset the
agent function never selected: asked to enumerate its tools, the agent listed
read, write, shell, glob, grep, question, skill, subagent, webfetch,
websearch, and execute ("run JavaScript in Code Mode"). Asked to fetch
`https://example.com`, it did — via builtin `webfetch`, no connection
declared, no tool attached in the render. So egress is open regardless of
declared connections, and `useTool` selection does not bound what the model
can do. The documented security story ("the platform validates destination,
method, path… before attaching the credential") is true of credentials but
silent about this: a prompt-injected agent can exfiltrate anything in its
context or workspace to any host with stock tools. Docs describe capability
selection as the model's boundary; the deployed behavior has no boundary.

## 012 — usetool-never-registers (bug, blocking)

2026-08-24 — step 5-6 probing. The documented code-defined tools flow does
not function. `defineTool` + `useTool` exactly per tools.mdx: deploy
succeeds, session runs, but the tool never exists at runtime — asked to call
`get_pull_request` and forbidden from using shell/webfetch, the agent
answered "There is no `get_pull_request` tool in my toolset". No deploy
warning, no session error, nothing in logs. Instructions returned by the
render DO apply (review structure was followed), so the render runs — its
tool selections just go nowhere. This blocks the core design of this example
(and means declared connections + managed secrets currently cannot be
exercised through tools at all).

## 013 — correction-008 (correction)

2026-08-24. Entry 008's conclusion was wrong. Given 012, the first review
session cannot have used `get_pull_request`/`get_diff`; it was produced by
the ambient builtins (011) fetching GitHub directly. Whether an
unauthenticated — or any — `defineConnection` egress path works is untested
and untestable until 012 is fixed. The "worked" signal was the agent routing
around my dead tools so smoothly the output was indistinguishable.

## 014 — no-way-to-see-what-ran (gap, extends 009)

2026-08-24. It took three probe sessions to discover 011-013, because no
public surface shows tool activity after the fact: `session inspect` returns
turn statuses only, `opencomputer logs --session` returned a single "runtime
connected" line, and the live CLI stream prints bare names (`tool: webfetch`)
for builtin tools only — the first review session printed nothing. A user
cannot distinguish "my tool ran" from "the model routed around my broken
tool"; that ambiguity is exactly how 008 went wrong. Session events with tool
calls, arguments, and results — or at minimum names in `session inspect` —
are a launch necessity.

## 015 — root-cause-artifact-kills-plugin (bug, blocking; supersedes 012's mechanism)

2026-08-25. Reproduced the full production runtime locally (pinned
`@opencode-ai/cli@0.0.0-next-17055` + the platform's reactive plugin built
from source + our byte-identical deployed artifact — digests match). The
tools machinery is fine; the failure chain is:

1. The CLI compiles each tool file standalone, rewriting only
   `@opencomputer/agent` imports. Our `import { github } from "../github"`
   compiled to a dangling specifier — `github.js` is simply not in the
   artifact. `ERR_MODULE_NOT_FOUND` at load.
2. The runtime plugin loads tool modules during setup; the import error
   rejects setup **before** the reactive machinery initializes, so one bad
   tool module kills renders, instructions, code tools, and builtin
   filtering for the whole session.
3. The engine swallows the plugin setup rejection: zero log output, zero
   session events, deploy reports success.

Instrumented marks show exactly `module-top → setup-entered →
before-registerCodeTools → ∅`. Fix directions: per-module isolation in the
plugin, loud plugin-failure surfacing, and build-time rejection (or
bundling) of unsupported imports.

## 016 — docs-pattern-produces-broken-artifact (bug, blocking)

2026-08-25. It is not just sibling modules: the **documented** tools
pattern breaks the same way. tools.mdx has `agent.ts` import
`"./tools/lookup-order"` — extensionless. Compiled output keeps the
specifier verbatim and the runtime loads it as Node ESM, so the agent
entry itself fails: `Cannot find module '.../tools/get-pull-request'`.
Every project following the docs' multi-file layout ships an artifact
whose agent function cannot load. Workaround: always import with the
`.js` suffix.

## 017 — connections-silently-dropped (bug)

2026-08-25. `defineConnection` is only discovered in `agent.ts` and
`tools/*.ts`. Our connection lived in `github.ts` (a sibling module —
natural for sharing between tools) and the manifest came out
`connections: []`, silently. No build warning. Combined with 015, the
failure was doubly invisible. Workaround: define connections in the same
file as the tools that use them.

## 018 — the-model-works-when-alive (nice; resolves 011, revises 012)

2026-08-25. After restructuring (one self-contained
`tools/github-tools.ts`, `.js` import suffix), everything the design
promises works live in development:

- `tool: get_pull_request` executes on the real platform;
- the render's tool selection is enforced — asked to fetch example.com,
  the agent has **no webfetch/shell/builtins at all**, only the two
  review tools; the conditional `post_review` gate holds (not exposed
  without live-post phrasing). **011 was a symptom of the dead plugin,
  not a separate egress hole** — with a working artifact the boundary is
  real;
- managed egress fails closed: with `GITHUB_TOKEN` unset, the connection
  returns 409 `secret_unavailable` ("missing or not allowed for this
  connection") — design 016 behaving exactly as written.

So the launch-blocking problem is precisely the silent-death modes
(015/016/017), not the security model.

## 019 — egress-observability (nice)

2026-08-25. The edge records `egress.request` both as a session event and
an agent log line with connection id, method, and path. Once tools run,
the platform-side audit trail for outbound requests exists — it is the
CLI session surface (009/014) that hides it.
