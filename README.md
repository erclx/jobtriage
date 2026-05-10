# jobtriage

A free-form chat agent over the Swedish JobTech jobs board. Ask questions like "which Stockholm AI roles mention agentic systems and have a deadline before next Friday" and get ranked answers with deadlines, employer, and a one-line rationale per ad. A daily-use CLI mirrors the chat tools.

## Features

- Free-form chat over the Swedish JobTech (Platsbanken) corpus
- Profile-aware ranking from a markdown profile pasted at chat time
- Triage workflow: shortlist, mark applied, mark declined, watch deadlines
- Side-by-side comparison of multiple ads against the same criteria
- Voice input on Chrome via the Web Speech API, with the mic affordance hidden cleanly on browsers that lack `SpeechRecognition`
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

The hybrid retrieval stack (BM25 plus dense embeddings plus reciprocal rank fusion over a local SQLite corpus) ships in this repo and powers the Typer CLI plus the local Next.js dev surface. The deployed demo at the live URL takes a different path. It calls the JobTech taxonomy and JobSearch APIs directly so it can answer for any profession a visitor pastes, instead of being pinned to the maintainer's AI-engineering corpus. The numbers below describe the repo and CLI story, reproducible end-to-end against the checked-in golden set.

_Repo and CLI configuration. The deployed demo serves live JobTech results and does not exercise these retrieval modes._

50-query Swedish golden set against a 59-ad corpus from Spotify, Klarna, Volvo Group, Volvo Cars, Ericsson, HT Engineering, Stig Ericsson Bil, Montico, and Isaksson Rekrytering. Embeddings from `intfloat/multilingual-e5-base`. Reproduce via `uv run jobtriage evaluate`.

| Configuration | precision@1 | precision@5 | precision@10 | recall@10 | p50 ms | p95 ms |
| ------------- | ----------- | ----------- | ------------ | --------- | ------ | ------ |
| filter-only   | 0.020       | 0.020       | 0.020        | 0.150     | 0.0    | 0.0    |
| bm25-only     | 0.680       | 0.224       | 0.124        | 0.920     | 0.2    | 1.2    |
| dense-only    | 0.780       | 0.240       | 0.132        | 0.965     | 6.4    | 7.8    |
| hybrid        | 0.720       | 0.240       | 0.128        | 0.950     | 6.2    | 15.2   |

## Multilingual embedding comparison

Same 50-query golden set, swapping the encoder while holding the corpus, BM25 index, and harness constant. The English-only baseline (`all-MiniLM-L6-v2`) measures what the project would look like without multilingual support. All three models share the e5 `passage:` / `query:` prefixes for an apples-to-apples input contract. Reproduce via `uv run jobtriage evaluate-embeddings`.

| Model                                  | Dim  | Configuration | precision@1 | precision@5 | precision@10 | recall@10 | p50 ms | p95 ms |
| -------------------------------------- | ---- | ------------- | ----------- | ----------- | ------------ | --------- | ------ | ------ |
| intfloat/multilingual-e5-base          | 768  | dense         | 0.780       | 0.240       | 0.132        | 0.965     | 4.4    | 6.0    |
| intfloat/multilingual-e5-base          | 768  | hybrid        | 0.740       | 0.240       | 0.128        | 0.950     | 4.8    | 6.0    |
| intfloat/multilingual-e5-large         | 1024 | dense         | 0.860       | 0.236       | 0.130        | 0.945     | 7.6    | 9.8    |
| intfloat/multilingual-e5-large         | 1024 | hybrid        | 0.820       | 0.236       | 0.126        | 0.940     | 8.2    | 9.6    |
| sentence-transformers/all-MiniLM-L6-v2 | 384  | dense         | 0.700       | 0.232       | 0.120        | 0.855     | 3.1    | 4.2    |
| sentence-transformers/all-MiniLM-L6-v2 | 384  | hybrid        | 0.760       | 0.236       | 0.128        | 0.925     | 3.3    | 3.9    |

The English-only baseline drops 11 points of recall@10 against e5-base on the Swedish golden set, and the BM25 floor recovers 7 of those points back through hybrid fusion. e5-large lifts precision@1 by 8 points over e5-base for ~70% more memory and ~70% more dense latency. All three models receive the e5 prefix tokens. For MiniLM those are noise tokens that suppress its dense numbers slightly, which we accept as the cost of a uniform input contract. The command loads each model in turn and releases between runs. Allow ≥4 GB free RAM for e5-large.

## Chat surface

The web app at `web/` ships a Next.js 16 spatial agent workspace built on AI Elements, the Vercel AI SDK, and React Flow v12. The first turn surfaces a gate with two paths:

- Paste an Anthropic API key. Held in browser sessionStorage and forwarded to `/api/chat` via a Bearer header. Never persisted on disk.
- Click "Use local Ollama" to route the agent loop through `gemma4:26b` on `localhost:11434`. Override the model id with `OLLAMA_MODEL_ID`.

The workspace is a resizable two-column layout: a left chat rail and a right React Flow canvas. The agent fires data tools (`searchJobs`, `semanticSearch`, `matchProfile`, `triageBatch`, `compareRoles`, `deadlineWatch`, `trackStatus`) plus paired spatial tools (`placeAds`, `groupAds`, `connectProfileToAds`, `pairAdsForCompare`, `placeAdsOnTimeline`, `pinToShortlist`, `markStatus`, `setView`). Retrieved ads land as draggable nodes on one of four canonical canvas views: triage clusters, deadline timeline, compare diff, or shortlist column. The profile is a persistent canvas node with weighted edges that spawn from it on profile-fit prompts, color-coded green / amber / muted by score bucket. Profile editing happens in a header dialog that auto-saves on close. Chat, canvas, and pinned shortlist persist across refresh in browser sessionStorage, with a header `New chat` action (confirmation-gated) to clear them. Below 1024px the canvas hides and the chat rail surfaces a "Best viewed on a desktop" notice. The chat input renders a mic toggle in Chrome that streams partial transcripts into the textarea while listening, commits the final transcript on stop or Escape, and stays hidden in Firefox and Safari. Theme defaults to system preference with a sun-and-moon toggle in the chat header.

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
