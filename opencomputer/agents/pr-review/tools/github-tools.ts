import {
  bearer,
  defineConnection,
  defineTool,
  useSecret,
  type DataValue,
} from "@opencomputer/agent";

// One self-contained module: the compiler bundles each tool file standalone
// and supports no relative imports besides @opencomputer/agent, so the
// connection and every tool that uses it live together here.

// GITHUB_TOKEN is a fine-grained PAT scoped to the repositories this agent
// reviews, with Pull requests: read/write. The platform attaches it at the
// outbound edge; it never enters the agent runtime.
export const github = defineConnection({
  id: "github-api",
  origin: "https://api.github.com",
  methods: ["GET", "POST"],
  pathPrefix: "/repos/",
  headers: {
    Authorization: bearer(useSecret("GITHUB_TOKEN")),
    // GitHub rejects any API request without a User-Agent (403), and the
    // platform's managed egress does not add one by default.
    "User-Agent": "opencomputer-pr-review-agent",
  },
});

// Failed requests come from two layers: GitHub itself, or the platform's
// managed egress rejecting the request before it leaves (RFC 7807 problem
// body, e.g. secret_unavailable). Surface which one so the error is
// actionable instead of blaming GitHub for everything. Only called on
// !response.ok, so consuming the body here never races the success path.
export async function describeFailure(response: Response, path: string) {
  const body = await response.text().catch(() => "");
  let detail = "";
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null) {
      const problem = parsed as Record<string, unknown>;
      // RFC 7807 is identified by its `type` member; `title` alone also
      // appears in ordinary GitHub error bodies.
      if (typeof problem.type === "string" && problem.type !== "") {
        detail =
          typeof problem.detail === "string"
            ? problem.detail
            : typeof problem.title === "string"
              ? problem.title
              : "";
        return `managed egress rejected ${path}: ${response.status} ${detail}`.trim();
      }
      detail =
        typeof problem.message === "string"
          ? problem.message
          : body.slice(0, 200);
    }
  } catch {
    detail = body.slice(0, 200);
  }
  detail = detail.trim();
  return `GitHub returned ${response.status} for ${path}${detail ? `: ${detail}` : ""}`;
}

export const getPullRequest = defineTool({
  name: "get_pull_request",
  description:
    "Fetch pull request metadata: title, body, author, branches, state, and change stats. Use this before reviewing a PR.",
  input: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner, e.g. acme" },
      repo: { type: "string", description: "Repository name, e.g. widgets" },
      number: { type: "number", description: "Pull request number" },
    },
    required: ["owner", "repo", "number"],
    additionalProperties: false,
  },
  async run({ input }): Promise<DataValue> {
    const path = `/repos/${input.owner}/${input.repo}/pulls/${input.number}`;
    const response = await github.fetch(path);
    if (!response.ok) {
      return { error: await describeFailure(response, path) };
    }
    const pr = await response.json();
    return {
      title: pr.title,
      body: pr.body,
      author: pr.user?.login,
      state: pr.state,
      draft: pr.draft,
      base: pr.base?.ref,
      head: pr.head?.ref,
      changedFiles: pr.changed_files,
      additions: pr.additions,
      deletions: pr.deletions,
    };
  },
});

// Keep the diff within a size a single review turn handles well.
const MAX_DIFF_CHARS = 150_000;

export const getDiff = defineTool({
  name: "get_diff",
  description:
    "Fetch the unified diff of a pull request. Call after get_pull_request; large diffs are truncated and flagged.",
  input: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner" },
      repo: { type: "string", description: "Repository name" },
      number: { type: "number", description: "Pull request number" },
    },
    required: ["owner", "repo", "number"],
    additionalProperties: false,
  },
  async run({ input }): Promise<DataValue> {
    const path = `/repos/${input.owner}/${input.repo}/pulls/${input.number}`;
    const response = await github.fetch(path, {
      headers: { Accept: "application/vnd.github.diff" },
    });
    if (!response.ok) {
      return { error: await describeFailure(response, path) };
    }
    const full = await response.text();
    const truncated = full.length > MAX_DIFF_CHARS;
    return {
      diff: truncated ? full.slice(0, MAX_DIFF_CHARS) : full,
      truncated,
      totalChars: full.length,
    };
  },
});

export const postReview = defineTool({
  name: "post_review",
  description:
    "Post the review on the pull request as a COMMENT review: a summary body plus optional inline comments anchored to diff lines. Use only after completing the review and only when the request asks for a live post.",
  input: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner" },
      repo: { type: "string", description: "Repository name" },
      number: { type: "number", description: "Pull request number" },
      body: { type: "string", description: "Review summary in GitHub Markdown" },
      comments: {
        type: "array",
        description:
          "Optional inline comments. line must be a line shown on the new (RIGHT) side of the diff.",
        items: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path in the repo" },
            line: { type: "number", description: "Line number on the new side" },
            body: { type: "string", description: "Comment in GitHub Markdown" },
          },
          required: ["path", "line", "body"],
          additionalProperties: false,
        },
      },
    },
    required: ["owner", "repo", "number", "body"],
    additionalProperties: false,
  },
  async run({ input }): Promise<DataValue> {
    const path = `/repos/${input.owner}/${input.repo}/pulls/${input.number}/reviews`;
    const reviewBody = typeof input.body === "string" ? input.body : "";
    const comments = Array.isArray(input.comments)
      ? (input.comments as ReadonlyArray<Record<string, DataValue>>).map(
          (c) => ({ ...c, side: "RIGHT" }),
        )
      : [];
    const post = (payload: DataValue) =>
      github.fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

    let response = await post({ event: "COMMENT", body: reviewBody, comments });
    if (response.status === 422 && comments.length > 0) {
      // Inline anchors can be rejected (renamed files, off-diff lines).
      // Fall back to a summary-only review rather than losing the review.
      response = await post({ event: "COMMENT", body: reviewBody });
      if (response.ok) {
        return { posted: true, inlineComments: 0, fallback: "summary-only" };
      }
    }
    if (!response.ok) {
      return { error: await describeFailure(response, path) };
    }
    const review = await response.json();
    return {
      posted: true,
      inlineComments: comments.length,
      url: review.html_url,
    };
  },
});
