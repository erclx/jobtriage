---
title: Deploy
description: Cloud Run, Vercel, and Cloudflare gotchas a Claude Code session must respect
---

# Deploy

Decisions and gotchas for the deployed surfaces. Procedural commands (`gcloud run deploy`, `vercel domains add`, DNS record values, smoke curls) live in `docs/deployment.md`.

## Gotchas

### `/healthz` is reserved by Cloud Run's edge

Use `GET /health` instead. Cloud Run's edge intercepts `/healthz` before the container and returns a Google Frontend 404. The interception is case-sensitive, so uppercase `/HEALTHZ` reaches the app but should never be relied on.

### Vercel Framework Preset must stay `Next.js` for App Router routes

If the build, output, or install overrides toggle on, Vercel clears the preset to `null` and stops applying its Next.js builder. The build still succeeds, but every route returns `x-vercel-error: NOT_FOUND` at runtime. If you hit this state, set Framework Preset back to `Next.js` and turn the override toggles off.

### Cloudflare proxy mode breaks Vercel SSL

DNS records pointing at Vercel must stay on **DNS only** (gray cloud) in Cloudflare. Orange-cloud proxy mode causes a Cloudflare 525 (SSL handshake failed) because Cloudflare's edge tries to negotiate SSL with Vercel's origin, which expects to terminate SSL itself.

### Hobby plan Deployment Protection defaults on

Vercel Hobby returns 401 or 404 to non-team-member traffic until Deployment Protection is set to `Disabled` under Settings. Anonymous visitors cannot reach the demo otherwise.

### Cloud Run cold-start is acceptable for BYOK demo

`min-instances 0` means the first request after idle pays a 1-5 second cold start. Acceptable because the user is already waiting on LLM streaming latency. Do not bump `min-instances` to 1 to chase cold-start metrics, it would push the Always-Free tier into paid.

## Decisions

### Slim image (`JOBTRIAGE_DEPLOY_MODE=slim`)

The Cloud Run image omits `sentence-transformers`, `torch`, and the SQLite corpus. The lifespan skips the embedder warmup. Corpus-dependent endpoints return 503 with `Corpus tools are disabled in deploy mode.` This is what the tool registry split in `agent.md` rests on.

### Per-provider model id env vars

`ANTHROPIC_MODEL_ID`, `OPENAI_MODEL_ID`, `GEMINI_MODEL_ID` override the defaults pinned in `web/src/app/api/chat/route.ts`. Production Vercel can A/B without a code edit. See `agent.md` for current defaults.

### Cloud Run memory pinned at 1Gi

`python/scripts/deploy.sh` ships `--memory 1Gi`. The prior `512Mi` cliffed under live-search plus live-details parallel load and SIGKILLed without a log. 1Gi stays inside the Always-Free tier because the binding limits are CPU-seconds and request count, not memory.
