---
title: CI
description: GitHub Actions workflow triggers and checks
---

# CI

GitHub Actions workflow for this monorepo. Three parallel jobs mirror the local verify cascade.

## Triggers

- Pull requests targeting `main`
- `workflow_dispatch` (manual run from the Actions tab)
- Nightly cron at 03:00 UTC for the eval workflow
- Weekly cron at 06:00 UTC on Mondays for the mock-fixture refresh workflow

## Workflows

| File                                          | Trigger                          | Purpose                                                          |
| --------------------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `.github/workflows/verify.yml`                | PR + workflow_dispatch           | Format, lint, types, tests, build                                |
| `.github/workflows/eval.yml`                  | Nightly cron + workflow_dispatch | Retrieval ablation against the golden set                        |
| `.github/workflows/agent-eval.yml`            | workflow_dispatch only           | Per-provider agent fixtures against Anthropic, OpenAI, Gemini    |
| `.github/workflows/refresh-mock-fixtures.yml` | Weekly cron + workflow_dispatch  | Re-capture mock-mode fixtures and open a refresh PR when changed |

## Verify jobs

Defined in `.github/workflows/verify.yml`. All jobs must pass before merge. Jobs run in parallel for speed.

### Root checks

| Step   | Command                | What it asserts                              |
| ------ | ---------------------- | -------------------------------------------- |
| Format | `bun run check:format` | prettier and shfmt are clean across the repo |
| Spell  | `bun run check:spell`  | cspell passes against dictionaries           |
| Shell  | `bun run check:shell`  | shellcheck passes at warning level           |

### Python checks

Runs in `python/` with `uv`.

| Step         | Command                        | What it asserts      |
| ------------ | ------------------------------ | -------------------- |
| Lint         | `uv run ruff check .`          | Ruff lint passes     |
| Format check | `uv run ruff format --check .` | Ruff format is clean |
| Typecheck    | `uv run mypy .`                | Strict mypy passes   |
| Tests        | `uv run pytest -v`             | pytest exits 0       |

### Web checks

Runs in `web/` with `bun`.

| Step      | Command             | What it asserts                  |
| --------- | ------------------- | -------------------------------- |
| Typecheck | `bunx tsc --noEmit` | TypeScript passes                |
| Lint      | `bun run lint`      | ESLint passes with zero warnings |
| Tests     | `bun run test:run`  | Vitest exits 0                   |
| Build     | `bun run build`     | Next production build succeeds   |

## Eval job

Defined in `.github/workflows/eval.yml`. Runs nightly at 03:00 UTC and on `workflow_dispatch`. Skips when no SQLite corpus is present in the runner.

## Agent eval job

Defined in `.github/workflows/agent-eval.yml`. Triggers on `workflow_dispatch` only so maintainer-funded providers stay capped. The `providers` input defaults to `gemini` (free tier). Maintainers must explicitly type `anthropic` or `openai` into the input to opt into paid runs. The `fixture` input picks the dispatch-supplied JSON fixture under `.claude/evals/`. The `only_input_fixture` boolean (default false) skips the hardcoded general-profile and conversation steps so a dispatch targets only the dispatch-supplied fixture. The job builds the web server then drives `web/scripts/model-probe.ts` three times per provider: against the dispatch-supplied fixture, then `agent-general-profile.json`, then `agent-conversation.json` (the v6 conversation kind covering tool-call accuracy, ad-id recall, keyword recall, concept-id discipline, and tool-error recovery). `PROBE_PROVIDER` and `PROBE_API_KEY` come from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GEMINI_API_KEY` secrets. Each run uploads both the Markdown table and the peer JSON artifact. Providers without a configured secret emit a warning and skip. The harness paces probes via `PROBE_INTER_PROBE_MS` with per-provider defaults (`gemini=6500`, others `0`) so free-tier rate limits do not return empty SSE on later probes. An explicit env override always wins.

## Refresh mock fixtures job

Defined in `.github/workflows/refresh-mock-fixtures.yml`. Runs Monday at 06:00 UTC and on `workflow_dispatch`. The job runs `bun run capture-mock` in `web/`, which re-captures the four mock-mode fixtures from live JobTech and validates every ad id against the ad-details endpoint (200 alive, 404 dead, anything else throws). The capture script emits raw JSON via `JSON.stringify`, so the workflow then runs Prettier scoped to `web/src/features/mock/scripts` to match the project's TypeScript style. Without that pass the bot PR would land as ~500 lines of double-quote vs single-quote churn that hides the real data changes. When the regenerated fixture files diff against the working tree, `peter-evans/create-pull-request` opens or updates a PR on the `bot/refresh-mock-fixtures` branch titled `chore(mock): refresh fixtures`. When fixtures are unchanged, no PR is opened. When upstream JobTech returns a status other than 200 or 404 for any ad, the capture script throws and the workflow surfaces a red badge so the maintainer sees the outage. Concurrency group `refresh-mock-fixtures` with `cancel-in-progress` keeps overlapping runs from fighting over the working tree. The built-in `GITHUB_TOKEN` covers the push and PR write. No PAT or extra secret is required.

The cadence is a weekly bot-opened PR with a human merge after eyeballing the fixture diff. Auto-merge stays off so a visitor-visible fixture rotation always gets a glance before it ships.

## Running CI locally

`bun run check` from the repo root runs the same cascade plus auto-formats first. If CI fails on format, run `bun run check` locally and commit the diff.
