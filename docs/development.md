---
title: Development
description: Setup, the verify cascade, and running the app locally against the real backend
---

# Development

How to get jobtriage running on your own machine, for local use or to contribute.

## Setup

Requires [Bun](https://bun.sh) and [uv](https://docs.astral.sh/uv/).

```bash
bun install
cd web && bun install
cd ../python && uv sync
```

## Running it

Two processes, in two terminals:

```bash
bun run dev:api          # FastAPI backend on http://127.0.0.1:8000
bun run restart:web      # Next.js production build on http://localhost:3000
```

`bun run dev` is disabled on this project. Next.js's file watcher does not hold up under WSL2 with this dependency tree, so `restart:web` rebuilds and serves a production build instead of running a dev server. Re-run it after each edit.

## Verify

`bun run check` from the repo root runs the full gate: format, spelling, shell lint, the Python suite (ruff, mypy, pytest), and the web suite (typecheck, lint, test). It runs automatically on `git push`.

| Command                         | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `bun run check`                 | Full cascade across both stacks                 |
| `cd web && bun run test:e2e`    | Playwright end-to-end, run manually before a PR |
| `cd python && uv run pytest -v` | Python tests alone                              |

## Refusals

- `bun run dev`: exits 1 with a pointer to `bun run restart:web`. This is intentional, not a broken script.
- A wall of `Cannot find module` errors from `tsc`: `web/node_modules` drifted behind the lockfile. Run `cd web && bun install`.

## Adjacent surface

[Deploy](deploy.md) covers taking your own fork to Cloud Run and Vercel. [Evaluation](evaluation.md) covers reproducing the retrieval and agent numbers.
