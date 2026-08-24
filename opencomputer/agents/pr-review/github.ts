import { bearer, defineConnection, useSecret } from "@opencomputer/agent";

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
  },
});
