# jobtriage

Triage Swedish job ads against any profile in a live agent workspace, with retrieval and a spatial canvas in one tab. Paste a profile, ask in plain language, watch the agent fan retrieved ads onto a canvas alongside its tool-call trace. Demo runs on bring-your-own-key.

Live demo: [jobtriage.erclx.dev](https://jobtriage.erclx.dev)

## Features

- Works for any profession. The deployed demo resolves "nursing in Stockholm" or "chef in Malmö" to JobTech taxonomy concepts on the fly, then runs the agent against live Platsbanken results.
- Spatial workspace. Retrieved ads land as draggable nodes on a React Flow canvas with four canonical views: triage clusters, deadline timeline, side-by-side compare, and a pinned shortlist.
- Bring-your-own-key. The deployed demo holds nothing server-side. The gate accepts an Anthropic, OpenAI, or Gemini key (browser sessionStorage only), or routes through local Ollama for a zero-key path.

## Quickstart

Requires [Bun](https://bun.sh) and [uv](https://docs.astral.sh/uv/).

```bash
bun install
cd web && bun install
cd ../python && uv sync
```

Start the FastAPI backend on `http://127.0.0.1:8000` and the web app on `http://localhost:3000`:

```bash
bun run dev:api          # FastAPI tool server
bun run restart:web      # Next.js production build, see docs/development.md
```

## How it works

The chat surface runs in the browser on the Vercel AI SDK. Each user turn fires the agent loop on a thin Next.js route handler that forwards the user-supplied API key as a Bearer token. Provider selection is per-request: the BYOK gate persists the choice in browser sessionStorage and sends it back as a header so the route can swap between Anthropic, OpenAI, Gemini, and local Ollama providers without a code edit.

Two postures share the same agent shell. The deployed demo runs `lookupConcept` against the JobTech taxonomy, then `searchJobs` against the live JobSearch API, then reasons in-context with `matchProfile` and `compareRoles` over the returned ads. The local CLI and the local browser dev surface keep the corpus-dependent stack: hybrid retrieval (BM25 plus dense over `multilingual-e5-base`) fused with reciprocal rank fusion, plus deadline filtering and engagement tracking against a local markdown log.

After every data tool the agent fires at least one spatial tool. The system prompt pins the pairings: `searchJobs` to `placeAds`, `triageBatch` to `groupAds`, `matchProfile` to `connectProfileToAds`, `compareRoles` to `pairAdsForCompare`, `deadlineWatch` to `placeAdsOnTimeline`, `trackStatus` to `markStatus`. The canvas is the answer, not a decoration of the chat transcript. Chat, canvas, and pinned shortlist all hydrate from sessionStorage on refresh so a recruiter pasting a profile mid-session never loses state.

Voice input ships in Chrome via the Web Speech API. The mic affordance hides cleanly in Firefox and Safari rather than breaking. Below 1024px the canvas hides and the chat rail surfaces a "Best viewed on a desktop" notice, since the spatial workspace is the load-bearing artifact.

For the full layered request flow, decision rationale, and known limitations, see [.claude/ARCHITECTURE.md](.claude/ARCHITECTURE.md).

## Hybrid retrieval ablation

Hybrid retrieval (BM25 plus dense embeddings fused via reciprocal rank fusion over a local SQLite corpus) powers the Typer CLI and the local Next.js dev surface. The deployed demo at the live URL does not run this path. It calls the JobTech taxonomy and JobSearch APIs directly so it can answer for any profession a visitor pastes, instead of being pinned to a maintainer-curated corpus. The numbers below describe the repo and CLI story, reproducible end-to-end against the checked-in golden set.

50-query Swedish golden set against a 59-ad corpus from Spotify, Klarna, Volvo Group, Volvo Cars, Ericsson, HT Engineering, Stig Ericsson Bil, Montico, and Isaksson Rekrytering. Embeddings from `intfloat/multilingual-e5-base`. Reproduce via `uv run jobtriage evaluate`.

| Configuration | precision@1 | precision@5 | precision@10 | recall@10 | p50 ms | p95 ms |
| ------------- | ----------- | ----------- | ------------ | --------- | ------ | ------ |
| filter-only   | 0.020       | 0.020       | 0.020        | 0.150     | 0.0    | 0.0    |
| bm25-only     | 0.680       | 0.224       | 0.124        | 0.920     | 0.2    | 1.2    |
| dense-only    | 0.780       | 0.240       | 0.132        | 0.965     | 6.4    | 7.8    |
| hybrid        | 0.720       | 0.240       | 0.128        | 0.950     | 6.2    | 15.2   |

Dense alone wins precision@1 on this corpus by 6 points over hybrid, and the multilingual table below shows the gap widens at the larger encoder. Hybrid still earns its place on recall and on adversarial queries where exact keyword matches (model names, employer-specific jargon) dominate. The score floor at `JOBTRIAGE_RRF_FLOOR=0.025` suppresses low-relevance noise at the API boundary. See [docs/retrieval.md](docs/retrieval.md) for the chunking strategy and the embedding prefix contract.

## Multilingual embedding comparison

Same 50-query golden set, swapping the encoder while holding the corpus, BM25 index, and harness constant. The English-only baseline (`all-MiniLM-L6-v2`) measures what the project would look like without multilingual support. Reproduce via `uv run jobtriage evaluate-embeddings`.

| Model                                  | Dim  | Configuration | precision@1 | precision@5 | precision@10 | recall@10 | p50 ms | p95 ms |
| -------------------------------------- | ---- | ------------- | ----------- | ----------- | ------------ | --------- | ------ | ------ |
| intfloat/multilingual-e5-base          | 768  | dense         | 0.780       | 0.240       | 0.132        | 0.965     | 4.4    | 6.0    |
| intfloat/multilingual-e5-base          | 768  | hybrid        | 0.740       | 0.240       | 0.128        | 0.950     | 4.8    | 6.0    |
| intfloat/multilingual-e5-large         | 1024 | dense         | 0.860       | 0.236       | 0.130        | 0.945     | 7.6    | 9.8    |
| intfloat/multilingual-e5-large         | 1024 | hybrid        | 0.820       | 0.236       | 0.126        | 0.940     | 8.2    | 9.6    |
| sentence-transformers/all-MiniLM-L6-v2 | 384  | dense         | 0.700       | 0.232       | 0.120        | 0.855     | 3.1    | 4.2    |
| sentence-transformers/all-MiniLM-L6-v2 | 384  | hybrid        | 0.760       | 0.236       | 0.128        | 0.925     | 3.3    | 3.9    |

The English-only baseline loses 11 points of recall@10 against `e5-base` on the Swedish golden set, and BM25 fusion recovers 7 of those points back. `e5-large` lifts precision@1 by 8 points over `e5-base` for `~70%` more memory and `~70%` more dense latency. MiniLM is the English-only baseline. The e5 prefix tokens it never trained on read as noise and suppress its dense numbers slightly. See [docs/retrieval.md](docs/retrieval.md) for the full prefix contract.

## Differentiation against prior art

Other public projects in adjacent space and the gap jobtriage fills:

- [santifer/career-ops](https://github.com/santifer/career-ops): a workflow framework built on Claude Code skills with a Go dashboard and PDF generation. Self-hosted, runs in your own Claude Code session. jobtriage is a hosted public demo with a spatial canvas, pinned to one national job board (JobTech / Platsbanken) where a recruiter can paste a profile and triage in a browser tab.
- [kyosek/RAG-based-job-search-assistant](https://github.com/kyosek/RAG-based-job-search-assistant): a RAG demo over a scraped LinkedIn snapshot. Static, English, no live ad freshness. jobtriage runs against live JobTech in deploy and runs hybrid retrieval over a Swedish-language corpus in the repo and CLI path, with the embedding ablation above to back the multilingual claim.
- [Jobtechdev-content/Jobsearch-content](https://github.com/Jobtechdev-content/Jobsearch-content) and similar JobTech API wrappers: SDK and content-level integrations. jobtriage layers an agent loop, profile-aware ranking, hybrid retrieval, and a spatial workspace on top of the same upstream API.

## Build approach

Built with Claude Code as the primary agent, planned through the `.claude/` planning docs ([REQUIREMENTS.md](.claude/REQUIREMENTS.md), [ARCHITECTURE.md](.claude/ARCHITECTURE.md), [TASKS.md](.claude/TASKS.md)) and gated by the coding standards in [.claude/rules/](.claude/rules). The full setup is reproducible from [CLAUDE.md](CLAUDE.md).

## Documentation

- [Development](docs/development.md) covers the verify cascade, scripts, and husky hooks.
- [Web](docs/web.md) covers the Next.js layout, AI SDK wiring, and React Flow canvas.
- [Python](docs/python.md) covers the FastAPI layout, the Typer CLI, and the HTTP API surface.
- [Retrieval](docs/retrieval.md) covers chunking, the embedding prefix contract, and the RRF score floor.
- [CI](docs/ci.md) covers the GitHub Actions job structure.
- [Architecture](.claude/ARCHITECTURE.md) covers the five-layer request flow and key technical decisions.
- [Requirements](.claude/REQUIREMENTS.md) covers the problem statement, MVP features, and constraints.

## License

MIT, see [LICENSE](LICENSE).
