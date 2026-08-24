import { defineTool } from "@opencomputer/agent";
import { github } from "../github";

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
  async run({ input }) {
    const path = `/repos/${input.owner}/${input.repo}/pulls/${input.number}`;
    const response = await github.fetch(path);
    if (!response.ok) {
      return { error: `GitHub returned ${response.status} for ${path}` };
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
