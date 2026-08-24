import { defineTool } from "@opencomputer/agent";
import { github } from "../github";

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
  async run({ input }) {
    const path = `/repos/${input.owner}/${input.repo}/pulls/${input.number}/reviews`;
    const comments = Array.isArray(input.comments)
      ? input.comments.map((c) => ({ ...c, side: "RIGHT" }))
      : [];
    const post = (payload) =>
      github.fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

    let response = await post({ event: "COMMENT", body: input.body, comments });
    if (response.status === 422 && comments.length > 0) {
      // Inline anchors can be rejected (renamed files, off-diff lines).
      // Fall back to a summary-only review rather than losing the review.
      response = await post({ event: "COMMENT", body: input.body });
      if (response.ok) {
        return { posted: true, inlineComments: 0, fallback: "summary-only" };
      }
    }
    if (!response.ok) {
      return { error: `GitHub returned ${response.status} for ${path}` };
    }
    const review = await response.json();
    return {
      posted: true,
      inlineComments: comments.length,
      url: review.html_url,
    };
  },
});
