# 4-minute demo runbook — Serverless Agents PR reviewer

Target repo: https://github.com/diggerhq/opencomputer-example-pr-review
(this repo; its `fixture/` orders API is the review target).
Primary review target: PR #2 (pagination + bulk discounts; planted bugs:
slice off-by-one, `>` vs the "10 or more" comment, fractional cents,
unvalidated page/pageSize) — PRISTINE, no reviews on it yet.
Rehearsed/fallback tab: PR #3 (auth middleware; review posted 2026-08-26
with 4 inline comments). The old oc-demo-webapp repo is archived.

## Preflight (before the demo)

- [ ] `npx opencomputer whoami` — logged in as the demo account.
- [ ] The fine-grained PAT (scoped to this repo, Pull requests: R/W) is at
      `~/.oc-demo-pat` (mode 600). Revoke it after the demo.
- [ ] Empty dir ready: `rm -rf ~/demo && mkdir ~/demo`.
- [ ] This folder's path handy:
      `~/Digger/_ws_opencomputer/opencomputer-example-pr-review/fixture/demo-prep`.
- [ ] Browser tabs: example repo PR #2 (Files changed), and PR #3's
      posted review as the "one it did earlier" fallback.
- [ ] Fallback terminal: `~/Digger/_ws_opencomputer/opencomputer-example-pr-review`
      (fully wired agent; `npm run session -- "..."` works there).
- [ ] Terminal font up; do NOT open the dashboard projects list (old test
      projects visible).
- [ ] Rehearsed 2026-08-26; measured: init 2s, npm install 5s, first
      deploy 2s, snippet cp + redeploy 1s, secrets set 1s, review+post
      session 62-66s. Total mechanics ~15s + one ~60-90s model wait.

## Script

0:00 — in `~/demo`:

    npx @opencomputer/cli init .
    # open opencomputer/agents/hello-world/agent.ts — 8 lines
    npm install
    npx opencomputer deploy --watch --create-project pr-reviewer

Say: deployed durable agent backend; no infra. Dashboard URL prints.

0:45 — new terminal pane, same dir:

    cp -r ~/Digger/_ws_opencomputer/opencomputer-example-pr-review/fixture/demo-prep/snippets/. opencomputer/agents/hello-world/
    # watcher redeploys on save; show github-tools.ts while it does
    npx opencomputer secrets set GITHUB_TOKEN < ~/.oc-demo-pat

Say: the connection declares the only reachable host/path; the platform
attaches the token at its edge — it never enters the agent runtime.

1:30 — the one wait:

    npx opencomputer session "Review diggerhq/opencomputer-example-pr-review#2 and post the review on the PR."

Narrate over the tool lines: two read tools, then post_review; posting
exists only because the request asked — dry run is the default.

3:15 — flip to the GitHub tab, refresh: inline comments on the diff.
Close: ~150 lines of agent code, one command to deploy, token scoped to
one repo. Flash (don't run):

    npx opencomputer webhooks create pr-ingress --agent current --environment development

Say: CI curls that URL and every PR gets this review with no human.

## Failure branches

- Session hangs >90s: switch to the fallback terminal and run the same
  command there (its project secret is the same PAT, so it works
  identically; `npm run session --` and `npx opencomputer session` are the
  same binary), or show PR #3's posted review: "one it did earlier".
- Deploy fails: fallback terminal is already deployed; continue from 1:30.
- Review misses planted bugs: point at whatever it did find — the flow is
  the demo.

## After the demo

- Revoke the demo PAT; `opencomputer secrets remove GITHUB_TOKEN` on the
  live-created project.
- Delete demo PRs' review comments only if re-running (re-reviews stack).
