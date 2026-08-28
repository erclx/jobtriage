# jobtriage

Triages Swedish job ads against a pasted profile, lays results onto a spatial canvas, and shows the agent's tool calls inline so the ranking stays auditable. Next.js app in `web/`, FastAPI tool server and CLI in `python/`.

## Context

Three-tier ownership model. Know which tier holds what before reading or writing.

- `README.md`: public pitch and 60-second setup for an outside visitor. No internal contracts.
- `.claude/context/`: per-domain working knowledge for Claude Code editing that domain. Layer responsibilities, decisions, gotchas, hidden contracts. See `.claude/context/index.md` for the catalog. New entries follow `.claude/standards/context.md`.
- `.claude/` planning docs (`ARCHITECTURE.md`, `REQUIREMENTS.md`, `DESIGN.md`): always-loaded product-wide invariants. Read before changes, when present. The `claude-feature` skill loads them in parallel. Wireframes live in `.claude/wireframes/` and diagrams in `.claude/diagrams/`, both loading on demand.
- `.claude/rules/`: coding standards. Always-on rules apply every session. Path-scoped rules apply to files matching their `paths:` glob.

Rule of thumb when a fact lives in two places: if an outside visitor needs it to evaluate the project, `README.md`. Everything a contributor or Claude needs to run or modify it lives in `.claude/context/`, keyed by domain.

@.claude/context/index.md
@.claude/REQUIREMENTS.md
@.claude/ARCHITECTURE.md
@.claude/wireframes/index.md

## Behavior

- Flag concerns or alternatives when a proposed change has tradeoffs worth discussing.
- When facing a judgment call with 2-3 reasonable options mid-flow, pick one and state the tradeoff in one sentence. Enumerate options only when the user's preference is the deciding factor.
- Match edit scope to the request. Ship minimal v1 and queue extensions as follow-ups.
- On simplification requests, edit only what the user named.
- Do not add features the user did not ask for.
- When rewriting a section, preserve existing code blocks, tables, and grouped examples unless the user asked to remove them.
- When planning an edit to `CLAUDE.md`, show the proposed change as a fenced `diff` block in chat first, then wait for approval before calling `Edit`
- This is a public repo. Do not write personal names into READMEs, `.claude/` planning docs, source comments, or commit messages. Use neutral phrasing like "the user", "a recruiter", or "a local file". Brief content under `.tmp/` is local context, not output.
- Do not cite `.claude/` paths (TASKS.md, plans, review, .tmp) from PR bodies, READMEs, or other artifacts a reviewer reads. Inline the context or use neutral phrasing like "queued as a follow-up".
- For deploy infrastructure (Cloud Run, Vercel, Cloudflare), prefer CLI over the dashboard. `gcloud` and `vercel` are authenticated locally and persist across sessions. Run inspection, redeploy, env-var, and domain commands from Bash rather than asking the user to click through. Confirm before destructive operations (delete service, force-push production, change live DNS).
- Before any multi-path `rm` or `rm -rf`, list every target path in chat and wait for explicit confirmation. "Clean up X" authorizes a different destructive action than a previous one, never a blanket nuke.
- Before proposing a new doc home for a convention (eval format, fixture kinds, scratch path), grep `CLAUDE.md` and `.claude/context/` for the topic. Extend the existing entry over creating a new section.

## Shipping

- After implementing a feature, run `bun run check` plus the test suite for the surfaces you touched. Fix what fails before opening a PR.
- After implementing a feature, run it end-to-end against real data (live API, populated database, deployed surface) and paste the output into the PR body under a `Live smoke` section. If a live run is impossible, say so explicitly instead of claiming success.
- Keep PR bodies evergreen. Beyond the `## Live smoke` block, run logs, follow-up notes, and polish narratives go into PR comments via `gh pr comment`, not the body.
- After a local commit on a feature branch, stop and hand control back. Push only when the user signals after browser verification. User-invoked skills that push by design (`/toolkit:git-ship`, `/toolkit:git-followup`) are exempt for that invocation only. Manual edits made between skill invocations require a fresh push signal.

## Indexes

- When a folder has an `index.md`, check it before reading individual files in that folder.
- For folders where an agent browses to pick a document, `index.md` is regenerated from each file's frontmatter. Do not hand-edit `index.md`. Code folders and scratch folders do not need one.
- Every `index.md` carries its own frontmatter (`title`, `subtitle`) that the walker preserves. To keep a folder's `index.md` hand-edited, add `auto: false` to its frontmatter.

## Markdown

- Before drafting a PR body, commit message, branch name, or snippet, read the matching standard in `.claude/standards/` and follow it. None of these is a file on disk, so no path-scoped rule fires for them.

## Commands

- `bun run check` runs the full verify cascade. Full script reference in `.claude/context/development.md`.
- Do not run `bun run dev`. The script is disabled. Run `bun run restart:web` from the repo root for any local server need. It kills stale `next-server` and Playwright zombies, rebuilds, starts the server in the background with logs at `.claude/.tmp/restart/server.log`, and verifies the listening pid changed. Do not rely on `lsof -ti:3000`, it can miss `next-server`.

## Output

- After creating or modifying a file, include its path on its own line so terminal emulators can make it clickable. Do not paraphrase paths into prose ("the seeds folder", "your CLAUDE.md").
- Use the path the user's editor can resolve. The editor is rooted at the main project root.
- In the main worktree: relative from `pwd` works because `pwd` equals the editor root.
- In a linked worktree (under `.claude/worktrees/<name>/`): use absolute paths. Relative paths from worktree `pwd` would not resolve against the editor's project root.
- When the response covers multiple files, group paths under headers: `**Created:**`, `**Modified:**`, `**Deleted:**`. For single-file changes, the path on its own line is enough.

## Key paths

- `web/`: Next.js app, bun-managed, owns the chat surface, canvas, and the agent route
- `python/`: FastAPI tool server and Typer CLI, uv-managed, owns retrieval and the JobTech client
- `scripts/`: repo-root shell tooling (restart, monitor)
- `.claude/`: planning docs (requirements, architecture, wireframes, design, tasks)
- `.claude/context/`: per-domain narrative loaded when editing that domain. See `.claude/context/index.md` for the catalog. Entries cover agent loop, canvas, ci, web, python, retrieval, evals, development, deploy.
- `.claude/wireframes/`: per-surface ASCII layouts loaded on demand, indexed via `.claude/wireframes/index.md`
- `.claude/evals/`: structured JSON fixtures consumed by `web/scripts/model-probe.ts`. See `.claude/context/evals.md` for fixture shape, `kind` semantics, and the `workflow_dispatch` posture.
- `.claude/review/`: gitignored scratch for review and UI-test output, overwritten on each run
- `wiki/`: durable reusable technical knowledge that outlives any single project decision (model landscapes, tool-stack notes, integration playbooks). Pages survive plan-file deletion when tasks ship.

## Spelling

- When cspell flags a word, rewrite typos. Add real terms to the right file under `.cspell/`: `companies.txt` for orgs and products, `people.txt` for person names, `tech-stack.txt` for tools and libs, `project-terms.txt` for everything else (jargon, acronyms, place names, project handles).
- Auto-generated fixtures pulled from external APIs (JobTech, taxonomy) go in `cspell.json` ignorePaths, not `.cspell/<bucket>.txt`. Keep hand-authored `index.ts` and `types.ts` scanned.
- Keep dictionary files sorted alphabetically.
- `@cspell/dict-sv` covers Swedish words. Do not add them to the custom txt files unless cspell still flags them after the dict is loaded.

## Tasks

- `.claude/tasks/` is gitignored local session scratch, one file per task per `aitk standards tasks`. Edit freely. No staging or revert before commits.
- Only create a task for work that spans multiple sessions or has real dependencies. Handle small edits immediately without a task entry.
- Do not add tasks retroactively for work already completed. Completed work is visible in git.

## Memory

- Write all memory files to `.claude/memory/`, not `~/.claude/projects/`.
- Save a feedback memory only when the same mistake happens twice in the session, or when the user explicitly corrects you. First-occurrence slips are noise.
- Keep feedback memories to 3 lines: the rule, a one-line Why, and a one-line How to apply. Capture the pattern, not the recovery narrative.
- Before creating a new memory file, check for an existing one on the same topic. Update rather than duplicate.

## Scratch

- Write temporary files to `.claude/.tmp/<slug>/<file>.md` in the project root. Use a kebab-slug tied to the topic. Never use `/tmp` or a flat `<slug>-<file>.md`.

## Worktrees

- Default to working on the active branch in the main checkout. Reach for a linked worktree via `/claude-worktree` only when a concurrent session would otherwise fight over working-tree state.
- Shared session scratch (`.claude/plans/`, `.claude/review/`, `.claude/memory/`, `.claude/tasks/`) lives at the main worktree root, not inside a linked worktree. From a linked worktree, resolve these paths against the main root via `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`. Fall back to `pwd` if not a git repo.
- From a linked worktree, every `Edit` or `Write` to a tracked file (source, docs) must use a path starting with `pwd`. Only shared session scratch (`.claude/plans/`, `.claude/review/`, `.claude/memory/`, `.claude/tasks/`) resolves to the main worktree root.
- The pre-push cspell check is blind to worktree changes because `useGitignore: true` walks up to the parent `.gitignore` that excludes `.claude/worktrees/`, and pushing from main scans `main`'s working tree, not the branch tip. Before pushing a worktree branch with new vocabulary (new product names, libs, jargon), spell-check the diff explicitly: `git diff --name-only main | grep -vE 'bun\.lock$|\.png$' | xargs bunx cspell --no-must-find-files --no-progress --no-gitignore`. Add unknown real words to the right `.cspell/<bucket>.txt` before pushing.
- Push a worktree branch from the main checkout via `cd <main-root> && git push -u origin <branch>`, not `git -C <main-root> push`. The career-level CLAUDE.md documents the `git -C` form, but in this repo it triggers a phantom prettier failure under pre-push (`Unable to read file ".claude/.claude/review/..."`). The `cd` form runs the same hook cleanly.
