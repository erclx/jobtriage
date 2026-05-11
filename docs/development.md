---
title: Development
description: Local dev workflow, verify cascade, and husky hooks
---

# Development

Local dev workflow for this monorepo. Two stack folders sit beside a thin orchestration root.

## Layout

- `web/`: Next.js app, bun-managed, owns its lint, tests, and build.
- `python/`: FastAPI backend and CLI, uv-managed, owns its lint, types, and tests.
- Root: format, spelling, shell checks, plus the cascade that runs both stack verifies.

> Per-stack structure and conventions live in the [web context](../.claude/context/web.md) and [python context](../.claude/context/python.md). Dev-rule rationale (why `bun run dev` is disabled, regen-and-gate, WSL2) lives in the [development context](../.claude/context/development.md).

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

`check` runs on every `git push` via the husky `pre-push` hook. The python verify also regenerates `python/openapi.json` and fails if the working copy drifts. Commit the regenerated file alongside the source change.

## Root scripts

| Command                | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `bun run check`        | Full cascade. Asserts format, spell, shell, python, and web checks pass. |
| `bun run dev:api`      | FastAPI backend with `--reload` on `http://127.0.0.1:8000`.              |
| `bun run restart:web`  | Kill stale `next-server`, rebuild, and serve on `http://localhost:3000`. |
| `bun run format`       | Auto-fix prettier and shfmt formatting.                                  |
| `bun run check:format` | Assert prettier and shfmt are clean.                                     |
| `bun run check:spell`  | Assert cspell passes against dictionaries.                               |
| `bun run check:shell`  | Assert shellcheck passes at warning level.                               |
| `bun run clean`        | Wipe `node_modules/`, clear bun cache, reinstall.                        |
| `bun run update`       | Interactive `bun update` followed by verification.                       |

## Web scripts

Run from `web/` after `cd web`.

| Command                 | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `bun run dev`           | Disabled. Prints a pointer to `bun run restart:web` and exits 1. |
| `bun run build`         | Production build.                                                |
| `bun run start`         | Serve the production build.                                      |
| `bun run lint`          | ESLint, zero warnings allowed.                                   |
| `bun run lint:fix`      | Auto-fix ESLint issues.                                          |
| `bun run typecheck`     | `tsc --noEmit`.                                                  |
| `bun run test`          | Vitest in watch mode.                                            |
| `bun run test:run`      | Vitest once with verbose reporter.                               |
| `bun run test:coverage` | Vitest with coverage.                                            |
| `bun run test:e2e`      | Playwright end-to-end.                                           |
| `bun run favicon`       | Regenerate `src/app/favicon.ico` from `src/app/icon.svg`.        |
| `bun run screenshots`   | Capture canonical UI states to `.claude/review/screenshots/`.    |
| `bun run check`         | Web verify (typecheck, lint, test).                              |

## Local smoke

To open the chat surface against the real backend on `http://localhost:3000`:

```bash
# terminal 1
bun run dev:api

# terminal 2
bun run restart:web
```

`bun run restart:web` calls `scripts/restart.sh`, which kills any stale `next-server` and Playwright zombies, rebuilds, starts the production server in the background, and verifies the listening pid changed before returning. Logs land at `.claude/.tmp/restart/server.log`. Re-run after each edit.

`bun run dev` is disabled at the package level and exits 1. Hot reload is not available locally on this machine. Rationale lives in the [development context](../.claude/context/development.md).

## Vercel preview deploys

Every push to a branch with an open PR triggers a Vercel preview deploy. The build takes about two minutes and produces two URLs in the PR comment:

- Per-commit immutable URL (`jobtriage-<commitHash>-erics-projects-...`): always reflects that exact commit
- Per-branch alias (`jobtriage-git-<branch>-erics-projects-...`): always points at the latest commit on the branch

Use the preview deploy when:

- A reviewer needs to click and see the change without a local checkout
- The change needs cross-device verification (phone, Safari, Edge)
- An OG card crawler needs to fetch the page (LinkedIn Post Inspector, Slack, Twitter Card Validator cannot reach localhost)
- Verifying that Vercel env vars and build settings produce the expected runtime

Stay on `bun run restart:web` for the inner loop. Local builds reflect edits in seconds, previews take minutes. Previews are for the outer loop: reviewing actual deploy behavior on real Vercel and Cloud Run infrastructure.

Deployment Protection is off for this project. Preview URLs are publicly accessible. If a branch ever needs gated previews, toggle Deployment Protection to `Only Preview Deployments` under Vercel project settings.

## Hardware monitor

Local LLM smoke runs (Ollama, the multilingual e5 embedder) can saturate WSL2 memory. Run `scripts/monitor.sh` in a separate terminal before starting any local model:

```bash
./scripts/monitor.sh                         # 3s interval, frame UI on stderr, samples on stdout
./scripts/monitor.sh 1                       # 1s interval
./scripts/monitor.sh > /tmp/mon.log 2>&1 &   # detach, background, single combined log
```

The script samples Windows host RAM, WSL guest RAM, GPU VRAM and utilization, and loaded Ollama models. Warns at host RAM 85% or GPU util 90%. Rationale and abort thresholds live in the [development context](../.claude/context/development.md).

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

All `.sh` files live under `scripts/` in their owning folder. Do not place shell scripts elsewhere. Verify scripts follow the [bash-script prompt](../prompts/bash-script.md).

## Husky hooks

- `pre-commit`: runs `lint-staged` against staged files (prettier, cspell, shfmt, shellcheck).
- `commit-msg`: runs `commitlint` against the conventional commit format.
- `pre-push`: runs `bun run check` (the full cascade). The cascade may reformat. After pushing, run `git status`. If files changed, commit the diff as `style(<scope>):` and push again. Do not skip with `--no-verify`.
