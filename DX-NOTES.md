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
