---
title: Deploy
description: Taking your own fork to Cloud Run, Vercel, and a custom domain
---

# Deploy

jobtriage ships as two surfaces: a FastAPI backend on Google Cloud Run and a Next.js frontend on Vercel. Both are BYOK and stateless, so deploying your own fork needs no provider secrets baked in.

## Backend

`cd python && ./scripts/deploy.sh`

First run creates the Cloud Run service. Later runs roll a new revision. Cloud Build uploads `python/`, builds the Docker image, and pushes it to Artifact Registry.

## Frontend

Connect the repo to Vercel with these project settings, then push to `main` for auto-deploy:

| Setting          | Value     |
| ---------------- | --------- |
| Root directory   | `web`     |
| Framework preset | `Next.js` |
| Node             | 24.x      |

Set `JOBTRIAGE_API_BASE_URL` (server-only) to your Cloud Run service URL in the Vercel project's environment variables.

## Custom domain

1. `bunx vercel@latest domains add <your-domain>`
2. At your DNS provider, add an `A` record for the subdomain pointing at `76.76.21.21`. If the DNS provider is Cloudflare, keep the record on **DNS only**, not the orange-cloud proxy.
3. Vercel verifies the record and issues a certificate within a few minutes.

## Smoke test

```bash
URL=https://your-cloud-run-url
curl -sS "$URL/health"
curl -sS -X POST "$URL/v1/taxonomy/lookup" -H 'content-type: application/json' -d '{"query":"developer","top_k":2}'
```

Then open the deployed frontend URL, paste a provider key in the BYOK gate, and send a prompt like "Show me developer roles in Stockholm." Confirm the tool trace fires and the canvas populates with ad nodes.

## Common failures

- **A Cloudflare-proxied DNS record breaks Vercel's SSL** with a 525 handshake error. Cloudflare's edge tries to terminate SSL that Vercel expects to terminate itself. Keep the record on DNS-only.
- **Every route 404s at runtime despite a successful build.** A build, output, or install command override in Vercel project settings clears the Framework Preset to `null` and stops the Next.js builder from applying. Reset the preset to `Next.js` and turn the overrides off.
- **Anonymous visitors get a 401 or 404 on the live URL.** Vercel's Hobby plan defaults Deployment Protection on for non-team traffic. Disable it under Settings for a public demo.
- **`/healthz` 404s from Cloud Run's own edge**, before the request reaches the container. Use `/health` instead.

## Adjacent surface

[Development](development.md) covers running the app locally before you deploy it.
