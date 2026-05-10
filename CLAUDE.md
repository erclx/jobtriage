# Project

[One-line description]

## Context

- Read `.claude/` state docs (`TASKS.md`, `ARCHITECTURE.md`, `REQUIREMENTS.md`, `DESIGN.md`, `WIREFRAMES.md`) before changes, when present. The `claude-feature` skill loads them in parallel.
- Coding standards live in `.claude/rules/` and load automatically. Always-on rules apply every session. Path-scoped rules apply to files matching their `paths:` glob.

## Behavior

- Flag concerns or alternatives when a proposed change has tradeoffs worth discussing.
- When facing a judgment call with 2-3 reasonable options mid-flow, pick one and state the tradeoff in one sentence. Enumerate options only when the user's preference is the deciding factor.
- Match edit scope to the request. Ship minimal v1 and queue extensions as follow-ups.
- On simplification requests, edit only what the user named.
- Do not add features the user did not ask for.
- When rewriting a section, preserve existing code blocks, tables, and grouped examples unless the user asked to remove them.
- This is a public repo. Do not write personal names into READMEs, `docs/`, `.claude/` planning docs, source comments, or commit messages. Use neutral phrasing like "the user", "a recruiter", or "a local file". Brief content under `.tmp/` is local context, not output.
- Do not cite `.claude/` paths (TASKS.md, plans, review, .tmp) from PR bodies, READMEs, or other artifacts a reviewer reads. Inline the context or use neutral phrasing like "queued as a follow-up".

## Testing the agent

- When you need to verify agent behavior (tool selection, prompt edits, model output, SSE shape), drive the running stack directly via `curl -X POST http://localhost:3000/api/chat`. Do not ask the user to open the browser and paste prompts unless the test requires visual rendering. Probe multiple times to surface non-determinism, since local Ollama is sampling-noisy.
- A minimal probe body: `{"messages":[{"id":"u1","role":"user","parts":[{"type":"text","text":"<prompt>"}]}],"profile":null}` with header `x-jobtriage-provider: ollama` for the local path or `Authorization: Bearer sk-ant-...` for the deployed Anthropic path.
- To exercise the deploy posture (live JobTech path, `lookupConcept` plus live `searchJobs`) on the local Ollama branch without burning Anthropic credits, add `x-jobtriage-mode: deploy` to the curl headers, or open the browser at `http://127.0.0.1:3000/?mode=deploy` so the chat client sends the same header. The route gates the override on the absence of `process.env.VERCEL`, so production traffic cannot force the posture.
- Read tool-call ordering with `grep -oE '"toolName":"[a-zA-Z]+"'` and final text with `grep -oE '"delta":"[^"]*"'`. The user runs visual checks (card layout, overflow, theme contrast).
- Before loading a local model, start `scripts/monitor.sh` and check host RAM via PowerShell. Override `num_ctx` to 8192 via `OLLAMA_NUM_CTX` or route `providerOptions`. Ollama's default 131k allocates a KV cache that spills WSL2 into Windows host RAM on 30B-class models. Abort if host is already at 80%.
- When a model ignores a prompt rule across 3-5 curl probes at the working temperature, stop tightening the prompt. Document it as a known limitation in the PR body and queue a model-swap or guard-rail follow-up instead.

## Shipping

- After implementing a feature, run `bun run check` plus the test suite for the surfaces you touched. Fix what fails before opening a PR.
- After implementing a feature, run it end-to-end against real data (live API, populated database, deployed surface) and paste the output into the PR body under a `Live smoke` section. If a live run is impossible, say so explicitly instead of claiming success.
- Keep PR bodies evergreen. Beyond the `## Live smoke` block, run logs, follow-up notes, and polish narratives go into PR comments via `gh pr comment`, not the body.

## Indexes

- When a folder has an `index.md`, check it before reading individual files in that folder.
- For folders where an agent browses to pick a document, `index.md` is regenerated from each file's frontmatter. Do not hand-edit `index.md`. Code folders and scratch folders do not need one.
- Every `index.md` carries its own frontmatter (`title`, `subtitle`) that the walker preserves. To keep a folder's `index.md` hand-edited, add `auto: false` to its frontmatter.

## Markdown

- Before writing or editing an artifact with a matching standard in `prompts/` or `standards/` (bash scripts, READMEs, PRs, commits, branches, snippets, skills, prose), read that file first and follow it.
- When editing `README.md`, follow `standards/readme.md`. Keep it user-facing. Technical detail belongs in `docs/` or `.claude/`.

## Commands

- `bun run check` runs the full verify cascade. Full script reference in `docs/development.md`.
- Do not run `bun run dev`. The script is disabled. Run `bun run restart:web` from the repo root for any local server need. It kills stale `next-server` and Playwright zombies, rebuilds, starts the server in the background with logs at `.claude/.tmp/restart/server.log`, and verifies the listening pid changed. Do not rely on `lsof -ti:3000`, it can miss `next-server`.

## Key paths

- `src/`: [description]
- `.claude/`: planning docs (requirements, architecture, wireframes, design, tasks)
- `.claude/evals/agent-conversations.md`: numbered manual prompts for chat surface testing, seed fixture for the v6 agent-eval harness. Each case lists expected tools, expected behavior, and known regression alarms. Run before opening a chat-touching PR.
- `.claude/evals/*.json`: structured fixtures consumed by `web/scripts/model-probe.ts`. Each file declares a `kind` plus a `probes` array. Supported kinds: `discipline` (chitchat versus tool-warranted), `language` (English versus Swedish detection), `pairing` (data tool plus spatial-tool pairing), `general-profile` (cross-profession deploy posture, carries inline `profiles` map keyed by `profileKey`, harness sends `x-jobtriage-mode: deploy`). Select via `PROBE_FIXTURE=.claude/evals/<file>.json` when running the harness.
- `.claude/review/`: gitignored scratch for review and UI-test output, overwritten on each run
- `wiki/`: durable reusable technical knowledge that outlives any single project decision (model landscapes, tool-stack notes, integration playbooks). Pages survive plan-file deletion when tasks ship.

## Spelling

- When cspell flags a word, rewrite typos. Add real terms to the right file under `.cspell/`: `companies.txt` for orgs and products, `people.txt` for person names, `tech-stack.txt` for tools and libs, `project-terms.txt` for everything else (jargon, acronyms, place names, project handles).
- Keep dictionary files sorted alphabetically.
- `@cspell/dict-sv` covers Swedish words. Do not add them to the custom txt files unless cspell still flags them after the dict is loaded.

## Snippets

- When a snippet is referenced with `@`, execute its instructions immediately using available session context.

## Tasks

- `.claude/TASKS.md` is gitignored local session scratch. Edit freely. No staging or revert before commits.
- Only create a task for work that spans multiple sessions or has real dependencies. Handle small edits immediately without a task entry.
- Do not add tasks retroactively for work already completed. Completed work is visible in git.
- When a task needs execution detail beyond `.claude/TASKS.md`, create a plan in `.claude/plans/` and link to it from the task block's intro paragraph. When that task ships, delete its plan file.
- Write the plan in the same session as the task block. The session that executes the plan later inherits reasoning context it would otherwise have to re-derive.

## Memory

- Write all memory files to `.claude/memory/`, not `~/.claude/projects/`.
- Save a feedback memory only when the same mistake happens twice in the session, or when the user explicitly corrects you. First-occurrence slips are noise.
- Keep feedback memories to 3 lines: the rule, a one-line Why, and a one-line How to apply. Capture the pattern, not the recovery narrative.
- Before creating a new memory file, check for an existing one on the same topic. Update rather than duplicate.

## Scratch

- Write temporary files to `.claude/.tmp/<slug>/<file>.md` in the project root. Use a kebab-slug tied to the topic. Never use `/tmp` or a flat `<slug>-<file>.md`.

## Worktrees

- Implementation work runs in a linked worktree. From the main worktree, enter one with `/claude-worktree` before editing tracked files for a feature.
- Shared session scratch (`.claude/plans/`, `.claude/review/`, `.claude/memory/`, `.claude/TASKS.md`) lives at the main worktree root, not inside a linked worktree. From a linked worktree, resolve these paths against the main root via `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`. Fall back to `pwd` if not a git repo.
- From a linked worktree, every `Edit` or `Write` to a tracked file (source, docs) must use a path starting with `pwd`. Only shared session scratch (`.claude/plans/`, `.claude/review/`, `.claude/memory/`, `.claude/TASKS.md`) resolves to the main worktree root.
