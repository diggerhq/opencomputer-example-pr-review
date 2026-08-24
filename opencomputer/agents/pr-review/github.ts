import { defineConnection } from "@opencomputer/agent";

// Unauthenticated for now: public repositories only (60 requests/hour on
// GitHub's anonymous tier). A GITHUB_TOKEN secret gets attached when the
// write path lands.
export const github = defineConnection({
  id: "github-api",
  origin: "https://api.github.com",
  methods: ["GET"],
  pathPrefix: "/repos/",
});
