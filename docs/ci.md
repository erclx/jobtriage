---
title: CI
description: GitHub Actions workflow triggers and checks
---

# CI

GitHub Actions workflow for this monorepo. Three parallel jobs mirror the local verify cascade.

## Triggers

- Pull requests targeting `main`
- `workflow_dispatch` (manual run from the Actions tab)

## Jobs

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

## Running CI locally

`bun run check` from the repo root runs the same cascade plus auto-formats first. If CI fails on format, run `bun run check` locally and commit the diff.
