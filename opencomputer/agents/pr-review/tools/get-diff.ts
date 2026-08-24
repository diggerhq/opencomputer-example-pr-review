import { defineTool } from "@opencomputer/agent";
import { github } from "../github";

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
  async run({ input }) {
    const path = `/repos/${input.owner}/${input.repo}/pulls/${input.number}`;
    const response = await github.fetch(path, {
      headers: { Accept: "application/vnd.github.diff" },
    });
    if (!response.ok) {
      return { error: `GitHub returned ${response.status} for ${path}` };
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
