---
title: Deployment
description: Cloud Run backend, Vercel frontend, and Cloudflare custom domain
---

# Deployment

Two surfaces ship the public demo: the Python FastAPI backend runs on Google Cloud Run, the Next.js frontend on Vercel. A custom domain at Cloudflare points at Vercel. The deployed image is BYOK and stateless. Anthropic, OpenAI, and Gemini keys live in the visitor's browser sessionStorage and forward per request.

## Backend (Cloud Run)

Runs out of `python/` as a Docker image built remotely by Cloud Build. The image is slim: it omits `sentence-transformers`, `torch`, and the SQLite corpus because the deploy posture excludes the corpus-backed tools. Endpoints that need the corpus return 503 with `Corpus tools are disabled in deploy mode.`

Region is `europe-west1` (Belgium), the closest free-tier-eligible region to the JobTech upstream. The service scales to zero and starts on the first request. Always-Free tier covers this workload at $0/month.

| File                             | Purpose                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `python/Dockerfile`              | Python 3.12 slim base, installs `requirements-deploy.txt`, copies `src/`, runs `python -m jobtriage.api`. |
| `python/requirements-deploy.txt` | Pinned slim dependency set. No torch, no sentence-transformers, no typer.                                 |
| `python/.dockerignore`           | Excludes `var/`, `tests/`, `evals/`, `*.db`, and other build noise.                                       |
| `python/.gcloudignore`           | Mirror of `.dockerignore` for `gcloud builds`.                                                            |
| `python/scripts/deploy.sh`       | One-shot `gcloud run deploy` wrapper. Reads `JOBTRIAGE_CLOUD_RUN_SERVICE` and `_REGION` overrides.        |

### Runtime configuration

The deploy image sets `JOBTRIAGE_DEPLOY_MODE=slim` so the lifespan skips the embedder warmup and routes corpus endpoints to a 503. Cloud Run injects `PORT`, which `jobtriage.api.__main__` honors with a fallback to `JOBTRIAGE_API_PORT` then `8000`.

### Health endpoint

`GET /health`. The endpoint is named `/health` rather than `/healthz` because Cloud Run's edge reserves the `/healthz` path and intercepts it before the container, returning a Google Frontend 404. The interception is case-sensitive, so uppercase `/HEALTHZ` reaches the app.

### Deploy

```bash
cd python
./scripts/deploy.sh
```

First run creates the service. Subsequent runs roll a new revision. Cloud Build uploads `python/` (filtered by `.gcloudignore`), runs the `Dockerfile`, pushes to Artifact Registry, and Cloud Run creates a new revision.

### Smoke

```bash
URL=https://jobtriage-<project-number>.europe-west1.run.app
curl -sS "$URL/health"
curl -sS -X POST "$URL/v1/taxonomy/lookup" -H 'content-type: application/json' -d '{"query":"sjuksköterska","top_k":2}'
curl -sS -X POST "$URL/v1/jobs/live-search" -H 'content-type: application/json' -d '{"query":"developer","top_k":2}'
curl -sS -X POST "$URL/v1/jobs/semantic" -H 'content-type: application/json' -d '{"query":"test","top_k":2}'  # expect 503
```

## Frontend (Vercel)

Runs out of `web/` as a Next.js 16 App Router project on the Vercel Hobby plan free tier.

### Project settings

| Setting          | Value                             |
| ---------------- | --------------------------------- |
| Root Directory   | `web`                             |
| Framework Preset | `Next.js`                         |
| Build Command    | default (`next build` via preset) |
| Install Command  | default (`bun install`)           |
| Node             | 24.x                              |

The framework preset must be set to `Next.js`. If you toggle the build, output, or install overrides on, Vercel clears the preset to `null` and stops applying its Next.js builder, which produces a deploy where every route returns `x-vercel-error: NOT_FOUND` even though the build succeeded. If you hit that, set Framework Preset back to `Next.js` and turn the override toggles off.

### Environment variables

| Key                      | Scope                            | Value                                                          |
| ------------------------ | -------------------------------- | -------------------------------------------------------------- |
| `JOBTRIAGE_API_BASE_URL` | Production, Preview, Development | Cloud Run service URL (server-only, no `NEXT_PUBLIC_` prefix). |
| `NEXT_PUBLIC_SITE_URL`   | Production                       | Custom domain, used by `metadataBase` for OG card resolution.  |

Optional model-id overrides (default to the values pinned in `web/src/app/api/chat/route.ts`):

| Key                  | Default                     |
| -------------------- | --------------------------- |
| `ANTHROPIC_MODEL_ID` | `claude-haiku-4-5-20251001` |
| `OPENAI_MODEL_ID`    | `gpt-5.1-mini`              |
| `GEMINI_MODEL_ID`    | `gemini-3-flash`            |

Deployment Protection must be set to `Disabled` (Settings → Deployment Protection) so anonymous visitors can hit the demo. The Hobby plan defaults this on and returns 401/404 to non-team-member traffic until disabled.

### Deploy

Vercel auto-deploys on push to `main` once the GitHub integration is connected. Manual redeploys:

```bash
bunx vercel@latest redeploy https://jobtriage-<hash>-<team-slug>.vercel.app
```

## Custom domain (Cloudflare)

`jobtriage.erclx.dev` resolves via Cloudflare DNS to Vercel's anycast IP.

1. Add the domain to the Vercel project: `bunx vercel@latest domains add jobtriage.erclx.dev`.
2. At Cloudflare, in the `erclx.dev` zone, add a DNS record:
   - Type: `A`
   - Name: `jobtriage`
   - IPv4: `76.76.21.21`
   - Proxy status: **DNS only** (gray cloud)
   - TTL: 60s or Auto
3. Vercel verifies the record and issues a Let's Encrypt cert within ~5 minutes.

The proxy status must be DNS-only. Orange-cloud proxy mode causes Cloudflare 525 (SSL handshake failed) because Cloudflare's edge tries to negotiate SSL with Vercel's origin, which expects to terminate SSL itself.

## Smoke after deploy

End-to-end smoke against the deployed surface:

```bash
URL=https://jobtriage.erclx.dev

curl -sS -o /dev/null -w "%{http_code}\n" "$URL/"
curl -sS -X POST "$URL/api/chat" \
  -H 'content-type: application/json' \
  -H 'x-jobtriage-provider: anthropic' \
  -H 'Authorization: Bearer sk-ant-...' \
  -d '{"messages":[{"id":"u1","role":"user","parts":[{"type":"text","text":"hi"}]}],"profile":null}'
```

For a visual smoke, open the URL in a cold browser tab, paste a key in the BYOK gate, send a tool-warranted prompt like `Show me nursing roles in Stockholm`, confirm the trace shows `lookupConcept` → `searchJobs` and the canvas populates with ad nodes.

Validate the OG card via the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) once the custom domain is live.

> Platform gotchas (Cloud Run `/healthz` collision, Vercel framework preset, Cloudflare DNS-only mode, Hobby Deployment Protection) live in the [deploy context](../.claude/context/deploy.md).
