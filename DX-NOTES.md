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
