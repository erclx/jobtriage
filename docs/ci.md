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

## Workflows

| File                               | Trigger                          | Purpose                                                       |
| ---------------------------------- | -------------------------------- | ------------------------------------------------------------- |
| `.github/workflows/verify.yml`     | PR + workflow_dispatch           | Format, lint, types, tests, build                             |
| `.github/workflows/eval.yml`       | Nightly cron + workflow_dispatch | Retrieval ablation against the golden set                     |
| `.github/workflows/agent-eval.yml` | workflow_dispatch only           | Per-provider agent fixtures against Anthropic, OpenAI, Gemini |

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

Defined in `.github/workflows/agent-eval.yml`. Triggers on `workflow_dispatch` only so maintainer-funded providers stay capped. Inputs select which providers (`anthropic`, `openai`, `gemini`) to run and which fixture path to use. The job builds the web server, drives `web/scripts/model-probe.ts` against the chosen fixture with `PROBE_PROVIDER` and `PROBE_API_KEY` sourced from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GEMINI_API_KEY` secrets, then uploads the per-provider Markdown comparison as a build artifact. Providers without a configured secret emit a warning and skip.

## Running CI locally

`bun run check` from the repo root runs the same cascade plus auto-formats first. If CI fails on format, run `bun run check` locally and commit the diff.
