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
