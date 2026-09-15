# jobtriage

Triages Swedish job ads against a pasted profile, lays results onto a spatial canvas, and shows the agent's tool calls inline so the ranking stays auditable. Next.js app in `web/`, FastAPI tool server and CLI in `python/`.

## Context

Three-tier ownership model. Know which tier holds what before reading or writing.

- `README.md`: public pitch and 60-second setup for an outside visitor. No internal contracts.
- `canon/context/`: per-domain working knowledge for Claude Code editing that domain. Layer responsibilities, decisions, gotchas, hidden contracts. See `canon/context/index.md` for the catalog. New entries follow the context standard, read with `canon standards context`.
- `canon/REQUIREMENTS.md`, `canon/ARCHITECTURE.md`: always-loaded product-wide invariants, eagerly loaded below. `canon/DESIGN.md` loads on demand when editing a UI surface, and wireframes live in `canon/wireframes/` and load on demand per surface.
- `.claude/rules/`: coding standards. Always-on rules apply every session. Path-scoped rules apply to files matching their `paths:` glob.

Rule of thumb when a fact lives in two places: if an outside visitor needs it to evaluate the project, `README.md`. Everything a contributor or Claude needs to run or modify it lives in `canon/context/`, keyed by domain.

@canon/context/index.md
@canon/REQUIREMENTS.md
@canon/ARCHITECTURE.md
@canon/wireframes/index.md

## Behavior

- This is a public repo. Do not write personal names into READMEs, `.claude/` or `canon/` planning docs, source comments, or commit messages. Use neutral phrasing like "the user", "a recruiter", or "a local file". Brief content under `.canon/tmp/` is local context, not output.
- Do not cite `.canon/` paths (tasks, plans, review, tmp) from PR bodies, READMEs, or other artifacts a reviewer reads. Inline the context or use neutral phrasing like "queued as a follow-up".
- For deploy infrastructure (Cloud Run, Vercel, Cloudflare), prefer CLI over the dashboard. `gcloud` and `vercel` are authenticated locally and persist across sessions. Run inspection, redeploy, env-var, and domain commands from Bash rather than asking the user to click through. Confirm before destructive operations (delete service, force-push production, change live DNS).
- Before any multi-path `rm` or `rm -rf`, list every target path in chat and wait for explicit confirmation. "Clean up X" authorizes a different destructive action than a previous one, never a blanket nuke.
- Before proposing a new doc home for a convention (eval format, fixture kinds, scratch path), grep `CLAUDE.md` and `canon/context/` for the topic. Extend the existing entry over creating a new section.

## Shipping

- After implementing a feature, run `bun run check` plus the test suite for the surfaces you touched. Fix what fails before opening a PR.
- After implementing a feature, run it end-to-end against real data (live API, populated database, deployed surface) and paste the output into the PR body under a `Live smoke` section. If a live run is impossible, say so explicitly instead of claiming success.
- Keep PR bodies evergreen. Beyond the `## Live smoke` block, run logs, follow-up notes, and polish narratives go into PR comments via `gh pr comment`, not the body.
- After a local commit on a feature branch, stop and hand control back. Push only when the user signals after browser verification. User-invoked skills that push by design (`/toolkit:git-ship`, `/toolkit:git-followup`) are exempt for that invocation only. Manual edits made between skill invocations require a fresh push signal.

## Commands

- `bun run check` runs the full verify cascade. Full script reference in `canon/context/development.md`.
- Do not run `bun run dev`. The script is disabled. Run `bun run restart:web` from the repo root for any local server need. It kills stale `next-server` and Playwright zombies, rebuilds, starts the server in the background with logs at `.canon/tmp/restart/server.log`, and verifies the listening pid changed. Do not rely on `lsof -ti:3000`, it can miss `next-server`.

## Key paths

- `web/`: Next.js app, bun-managed, owns the chat surface, canvas, and the agent route
- `python/`: FastAPI tool server and Typer CLI, uv-managed, owns retrieval and the JobTech client
- `scripts/`: repo-root shell tooling (restart, monitor)
- `.claude/`: rules, hooks, settings, and eval fixtures
- `canon/`: canonical docs (`ARCHITECTURE.md`, `REQUIREMENTS.md`, `DESIGN.md`), per-domain context, and wireframes
- `canon/context/`: per-domain narrative loaded when editing that domain. See `canon/context/index.md` for the catalog. Entries cover agent loop, canvas, ci, web, python, retrieval, evals, development, deploy.
- `canon/wireframes/`: per-surface ASCII layouts loaded on demand, indexed via `canon/wireframes/index.md`
- `.claude/evals/`: structured JSON fixtures consumed by `web/scripts/model-probe.ts`. See `canon/context/evals.md` for fixture shape, `kind` semantics, and the `workflow_dispatch` posture.
- `.canon/tasks/`: gitignored task board, one file per task, indexed via `.canon/tasks/index.md`
- `.canon/diagrams/`: gitignored per-kind Mermaid views, indexed via `.canon/diagrams/index.md`
- `.canon/review/`: gitignored scratch for review and UI-test output, overwritten on each run
- `wiki/`: durable reusable technical knowledge that outlives any single project decision (model landscapes, tool-stack notes, integration playbooks). Pages survive plan-file deletion when tasks ship.

## Spelling

- Route a real term to the right file under `.cspell/`: `companies.txt` for orgs and products, `people.txt` for person names, `tech-stack.txt` for tools and libs, `project-terms.txt` for everything else (jargon, acronyms, place names, project handles).
- Auto-generated fixtures pulled from external APIs (JobTech, taxonomy) go in `cspell.json` ignorePaths, not `.cspell/<bucket>.txt`. Keep hand-authored `index.ts` and `types.ts` scanned.
- `@cspell/dict-sv` covers Swedish words. Do not add them to the custom txt files unless cspell still flags them after the dict is loaded.

## Snippets

- Before drafting a new snippet, load the `canon:create-snippet` skill and follow the standard it carries. It is not a file on disk, so no path-scoped rule fires for it, and it does not resolve through `canon standards`.

## Memory

- Save a feedback memory only when the same mistake happens twice in the session, or when the user explicitly corrects you. First-occurrence slips are noise.
- Keep feedback memories to 3 lines: the rule, a one-line Why, and a one-line How to apply. Capture the pattern, not the recovery narrative.
- Before creating a new memory file, check for an existing one on the same topic. Update rather than duplicate.

## Worktrees

- Default to working on the active branch in the main checkout, the opposite of the toolkit's own default. Reach for a linked worktree via `/claude-worktree` only when a concurrent session would otherwise fight over working-tree state.
- The pre-push cspell check is blind to worktree changes because `useGitignore: true` walks up to the parent `.gitignore` that excludes `.claude/worktrees/`, and pushing from main scans `main`'s working tree, not the branch tip. Before pushing a worktree branch with new vocabulary (new product names, libs, jargon), spell-check the diff explicitly: `git diff --name-only main | grep -vE 'bun\.lock$|\.png$' | xargs bunx cspell --no-must-find-files --no-progress --no-gitignore`. Add unknown real words to the right `.cspell/<bucket>.txt` before pushing.
- Push a worktree branch from the main checkout via `cd <main-root> && git push -u origin <branch>`, not `git -C <main-root> push`. The career-level CLAUDE.md documents the `git -C` form, but in this repo it triggers a phantom prettier failure under pre-push (`Unable to read file ".claude/.canon/review/..."`). The `cd` form runs the same hook cleanly.
