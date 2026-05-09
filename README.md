# jobtriage

A free-form chat agent over the Swedish JobTech jobs board. Ask questions like "which Stockholm AI roles mention agentic systems and have a deadline before next Friday" and get ranked answers with deadlines, employer, and a one-line rationale per ad. A daily-use CLI mirrors the chat tools.

## Features

- Free-form chat over the Swedish JobTech (Platsbanken) corpus
- Profile-aware ranking from a markdown profile pasted at chat time
- Triage workflow: shortlist, mark applied, mark declined, watch deadlines
- Side-by-side comparison of multiple ads against the same criteria
- Daily-use CLI mirrors every chat tool

## Installation

Requires [Bun](https://bun.sh) and [uv](https://docs.astral.sh/uv/).

```bash
bun install
cd web && bun install
cd ../python && uv sync
```

## Usage

```bash
# Verify everything
bun run check

# Web on http://localhost:3000 (production build, see docs/development.md for why)
cd web && bun run build && bun run start

# FastAPI backend (serves the Python tools to the web app)
bun run dev:api

# Sweep Platsbanken into a local SQLite file
cd python && uv run jobtriage sweep --employer 'Volvo' --db ../var/jobtriage.db

# Embed chunks with multilingual-e5-base (downloads ~280 MB on first run)
cd python && uv run jobtriage index --db ../var/jobtriage.db

# Hybrid search across keyword and semantic match
cd python && uv run jobtriage search 'AI ingenjör Stockholm' --db ../var/jobtriage.db --top-k 5

# Run the four-configuration retrieval ablation against the golden set
cd python && uv run jobtriage evaluate --db ../var/jobtriage.db

# Record engagement state for an ad
cd python && uv run jobtriage mark-status <ad-id> applied --note 'submitted via portal'
```

## Hybrid retrieval ablation

40-query Swedish golden set against a 59-ad corpus from Spotify, Klarna, Volvo Group, Volvo Cars, and Ericsson. Embeddings from `intfloat/multilingual-e5-base`. Reproduce via `uv run jobtriage evaluate`.

| Configuration | precision@1 | precision@5 | precision@10 | recall@10 | p50 ms | p95 ms |
| ------------- | ----------- | ----------- | ------------ | --------- | ------ | ------ |
| filter-only   | 0.025       | 0.020       | 0.018        | 0.113     | 0.0    | 0.0    |
| bm25-only     | 0.775       | 0.255       | 0.135        | 0.963     | 0.2    | 0.3    |
| dense-only    | 0.850       | 0.250       | 0.138        | 0.969     | 5.6    | 7.8    |
| hybrid        | 0.825       | 0.255       | 0.135        | 0.963     | 5.8    | 7.3    |

## Chat surface

The web app at `web/` ships a Next.js 16 spatial agent workspace built on AI Elements, the Vercel AI SDK, and React Flow v12. The first turn surfaces a gate with two paths:

- Paste an Anthropic API key. Held in browser sessionStorage and forwarded to `/api/chat` via a Bearer header. Never persisted on disk.
- Click "Use local Ollama" to route the agent loop through `gemma4:26b` on `localhost:11434`. Override the model id with `OLLAMA_MODEL_ID`.

The workspace is a resizable two-column layout: a left chat rail and a right React Flow canvas. The agent fires data tools (`searchJobs`, `semanticSearch`, `matchProfile`, `triageBatch`, `compareRoles`, `deadlineWatch`, `trackStatus`) plus paired spatial tools (`placeAds`, `groupAds`, `connectProfileToAds`, `pairAdsForCompare`, `placeAdsOnTimeline`, `pinToShortlist`, `markStatus`, `setView`). Retrieved ads land as draggable nodes on one of four canonical canvas views: triage clusters, deadline timeline, compare diff, or shortlist column. The profile is a persistent canvas node with weighted edges that spawn from it on profile-fit prompts, color-coded green / amber / muted by score bucket. Profile editing happens in a header dialog that auto-saves on close. Below 1024px the canvas hides and the chat rail surfaces a "Best viewed on a desktop" notice. Theme defaults to system preference with a sun-and-moon toggle in the chat header.

## HTTP API

The FastAPI app at `python/src/jobtriage/api/` exposes the tools the web frontend calls. `bun run dev:api` starts it on `http://127.0.0.1:8000`.

| Method + path                | Tool                           | Behavior                                                                |
| ---------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `POST /v1/jobs/search`       | `searchJobs`                   | Structured filter over the local SQLite corpus.                         |
| `POST /v1/jobs/semantic`     | `semanticSearch`               | Hybrid keyword and dense retrieval.                                     |
| `POST /v1/jobs/details`      | `matchProfile`, `compareRoles` | Description excerpts for one or more ad ids.                            |
| `POST /v1/jobs/triage`       | `triageBatch`                  | Hybrid retrieval plus description excerpts in one round trip.           |
| `POST /v1/jobs/deadline`     | `deadlineWatch`                | Active ads with deadlines inside a window of days, ordered by soonest.  |
| `GET /v1/engagements/status` | `trackStatus`                  | Engagement-log entries for one ad id. Empty list when no record exists. |
| `GET /healthz`               | -                              | Runtime configuration smoke.                                            |
| `GET /openapi.json`          | -                              | Schema for type generation.                                             |

The same OpenAPI schema is checked in at `python/openapi.json` and refreshed by the verify cascade. The CLI imports the same Python modules directly without going through HTTP.

## Documentation

- [Development workflow](docs/development.md) covers the verify cascade, scripts, and husky hooks.
- [Web stack](docs/web.md) covers Next.js layout, conventions, and scripts.
- [Python stack](docs/python.md) covers the FastAPI/CLI layout, conventions, and uv commands.
- [CI reference](docs/ci.md) describes the parallel job structure on GitHub Actions.
- [Architecture](.claude/ARCHITECTURE.md) documents the five-layer request flow and key technical decisions.
- [Requirements](.claude/REQUIREMENTS.md) describes the problem, MVP features, and constraints.
