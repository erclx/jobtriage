---
title: Development
description: Local dev workflow, verify cascade, and husky hooks
---

# Development

Local dev workflow for this monorepo. Two stack folders sit beside a thin orchestration root.

## Layout

- `web/`: Next.js app, bun-managed, owns its lint, tests, and build. See [web.md](web.md).
- `python/`: FastAPI backend and CLI, uv-managed, owns its lint, types, and tests. See [python.md](python.md).
- Root: format, spelling, shell checks, plus the cascade that runs both stack verifies.

## Setup

- Install [Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
- Install [uv](https://docs.astral.sh/uv/): `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Root deps: `bun install`
- Web deps: `cd web && bun install`
- Python deps: `cd python && uv sync`

## Verify cascade

| Command         | What runs                                                                      | Approx wall |
| --------------- | ------------------------------------------------------------------------------ | ----------- |
| `bun run check` | Format, spell, shell, python (ruff, mypy, pytest), web (typecheck, lint, test) | ~5s         |

`check` runs on every `git push` via the husky `pre-push` hook. `next build` and Playwright e2e stay out of the cascade by design. The previous scaffold ran `next build` in `pre-push` and froze under WSL2. CI now runs the build on every PR instead. Run `cd web && bun run build` and `cd web && bun run test:e2e` manually before opening a PR if you want full parity.

The python verify also regenerates `python/openapi.json` and fails if the working copy drifts. After backend changes that move endpoints or schemas, the regeneration is automatic. Commit the diff alongside the source change.

## Root scripts

| Command                | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `bun run check`        | Full cascade. Asserts format, spell, shell, python, and web checks pass. |
| `bun run dev:api`      | FastAPI backend with `--reload` on `http://127.0.0.1:8000`.              |
| `bun run format`       | Auto-fix prettier and shfmt formatting.                                  |
| `bun run check:format` | Assert prettier and shfmt are clean.                                     |
| `bun run check:spell`  | Assert cspell passes against dictionaries.                               |
| `bun run check:shell`  | Assert shellcheck passes at warning level.                               |
| `bun run clean`        | Wipe `node_modules/`, clear bun cache, reinstall.                        |
| `bun run update`       | Interactive `bun update` followed by verification.                       |

## Web scripts

Run from `web/` after `cd web`.

| Command                 | Purpose                             |
| ----------------------- | ----------------------------------- |
| `bun run dev`           | Next dev server with hot reload.    |
| `bun run build`         | Production build.                   |
| `bun run start`         | Serve the production build.         |
| `bun run lint`          | ESLint, zero warnings allowed.      |
| `bun run lint:fix`      | Auto-fix ESLint issues.             |
| `bun run typecheck`     | `tsc --noEmit`.                     |
| `bun run test`          | Vitest in watch mode.               |
| `bun run test:run`      | Vitest once with verbose reporter.  |
| `bun run test:coverage` | Vitest with coverage.               |
| `bun run test:e2e`      | Playwright end-to-end.              |
| `bun run check`         | Web verify (typecheck, lint, test). |

## Python commands

Run from `python/` after `cd python`.

| Command                  | Purpose                   |
| ------------------------ | ------------------------- |
| `uv run ruff check .`    | Lint.                     |
| `uv run ruff format .`   | Auto-format.              |
| `uv run mypy .`          | Strict typecheck.         |
| `uv run pytest -v`       | Tests.                    |
| `bash scripts/verify.sh` | Full python verify.       |
| `uv run jobtriage-api`   | Start the FastAPI server. |

## Shell scripts

All `.sh` files live under `scripts/` in their owning folder. Do not place shell scripts elsewhere. Verify scripts follow `prompts/bash-script.md`.

## Husky hooks

- `pre-commit`: runs `lint-staged` against staged files (prettier, cspell, shfmt, shellcheck).
- `commit-msg`: runs `commitlint` against the conventional commit format.
- `pre-push`: runs `bun run check` (the full cascade). After pushing, run `git status`. If files changed, commit the diff as `style(<scope>):` and push again.
