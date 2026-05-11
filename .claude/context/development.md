---
title: Development
description: Local dev rules, WSL2 constraints, and regen-gate workflow for Claude Code
---

# Development

Rules and rationale a Claude Code session must respect when editing this repo. Setup commands, scripts tables, and contributor onboarding live in `docs/development.md`.

## Decisions

### `bun run dev` is disabled, use `bun run restart:web`

Turbopack's file watcher walks the AI Elements plus shadcn dep tree and freezes WSL2 (vercel/next.js issues #87796, #91161, #66326). The `dev` script exits 1 at the package level with a pointer to `restart:web`. The Playwright `webServer` runs `build && start` for the same reason. Hot reload is not available on this machine.

`bun run restart:web` calls `scripts/restart.sh`, which kills any stale `next-server` and Playwright zombies, rebuilds, starts the production server in the background, and verifies the listening pid changed before returning. Logs land at `.claude/.tmp/restart/server.log`. Re-run after each edit.

Do not rely on `lsof -ti:3000` to detect stale servers, it misses `next-server`. The restart script handles process discovery.

### Regen-and-gate pattern requires `.prettierignore` co-update

When adding a regen-and-gate pattern (FastAPI OpenAPI export, codegen, schema dumps), append the artifact path to `.prettierignore` in the same commit. Otherwise prettier and the regen disagree on layout and the freshness check fails on every push.

The python verify regenerates `python/openapi.json` and fails if the working copy drifts. After backend changes that move endpoints or schemas, the regeneration is automatic. Commit the diff alongside the source change.

### Husky pre-push reformat behavior

The pre-push hook runs the full `bun run check` cascade. The cascade may reformat files. After `git push`, run `git status`. If files were modified, commit the diff as `style(<scope>):` and push again. Do not skip the hook with `--no-verify`.

### Dev-vs-deploy gates use `process.env.VERCEL`

`bun run restart:web` runs `next build && next start`, which sets `NODE_ENV=production` even on the local dev box. Anywhere a flag distinguishes "local dev" from "deployed", use `process.env.VERCEL` rather than `NODE_ENV !== 'production'`. The v4.10 deploy-mode override gate was first written against `NODE_ENV` and silently failed on the local browser path until the resolver was rewired to `VERCEL`.

### Ollama `num_ctx` floor at 8192

The Ollama branch sets `num_ctx` to 8192 by default via `providerOptions`, overridable through `OLLAMA_NUM_CTX`. Ollama's stock 131k context window allocates a KV cache that spills past WSL2's memory cap into Windows host RAM under inference, freezing the desktop. The 8192 floor fits the agent loop with multi-turn tool calls and keeps the cache resident in VRAM.

## Gotchas

### Hardware monitor before any local model load

Local LLM smoke runs (Ollama with `gemma4:26b`, the multilingual e5 embedder) can saturate WSL2 memory or push the Windows host into swap. WSL2 caps the guest at half the host by default, so the Linux side reports a much smaller ceiling than the physical install.

Run `scripts/monitor.sh` in a separate terminal before starting any local model. The script samples four pressure sources every 3s (Windows host RAM, WSL guest RAM, GPU VRAM and utilization, loaded Ollama models) and warns at host RAM 85% or GPU util 90%. Abort the model load if host is already at 80%.

### `next build` and Playwright e2e are out of the verify cascade by design

The previous scaffold ran `next build` in `pre-push` and froze under WSL2. CI now runs the build on every PR instead. Run `cd web && bun run build` and `cd web && bun run test:e2e` manually before opening a PR if you want full parity.
