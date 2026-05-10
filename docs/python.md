---
title: Python
description: FastAPI backend, Python tools, and Typer CLI structure
---

# Python

FastAPI backend, Python tools, and Typer CLI. The same Python modules power the HTTP layer the web app calls and the CLI for local daily triage.

## Stack

- Python 3.12, managed with [uv](https://docs.astral.sh/uv/)
- FastAPI for the HTTP layer
- Typer for the CLI
- SQLite for storage. FTS5 for the BM25 keyword index. A nullable `embedding` BLOB column on `ad_chunks` holds dense vectors, scored in-process via numpy cosine.
- `intfloat/multilingual-e5-base` for embeddings (v1), via `sentence-transformers`
- `httpx` for the JobTech API client
- `ruff` for lint and format, `mypy` for strict types, `pytest` for tests

Typer, httpx, pydantic, and pydantic-settings shipped in v0. The hybrid retriever, embedder, and eval harness shipped in v1. FastAPI shipped in v2 per [ARCHITECTURE.md](../.claude/ARCHITECTURE.md).

## Layout

```plaintext
python/
├── src/
│   └── jobtriage/
│       ├── __init__.py
│       ├── __main__.py         ← `python -m jobtriage` entrypoint
│       ├── settings.py         ← pydantic-settings, env-prefixed JOBTRIAGE_
│       ├── errors.py           ← project-rooted exception hierarchy
│       ├── engagement.py       ← mark-status writer for the engagement log
│       ├── api/                ← FastAPI app, routers, schemas, dependencies
│       ├── jobtech/            ← async JobTech client + pydantic models
│       ├── storage/            ← SQLite schema, chunker, append-mostly ingest
│       ├── embeddings.py       ← multilingual-e5 wrapper with passage/query prefixes
│       ├── retrieval.py        ← BM25, dense cosine, reciprocal rank fusion
│       ├── evals/              ← golden-set loader and ablation harness
│       └── cli/                ← Typer commands: sweep, mark-status, index, search, evaluate, evaluate-embeddings
├── tests/                      ← pytest, mirrors src/ layout
├── scripts/
│   ├── verify.sh               ← Python verify (ruff, mypy, pytest, openapi freshness)
│   ├── serve.sh                ← `bun run dev:api` runner, uvicorn with `--reload`
│   └── export_openapi.py       ← regenerates `openapi.json`, called from verify.sh
├── openapi.json                ← FastAPI schema, regenerated and gated by verify.sh
├── .python-version             ← 3.12
├── pyproject.toml              ← project + [dependency-groups] dev + hatchling
├── ruff.toml
├── mypy.ini
├── pytest.ini
└── .coveragerc
```

The `storage/` schema reserves a nullable `embedding` BLOB column on `ad_chunks` that v1 backfills via the `index` command. An `ad_chunks_fts` virtual table mirrors chunk text under FTS5 for BM25 queries, kept in lockstep with chunk inserts and deletes.

## Layer responsibilities

- `jobtech/`: async httpx client and pydantic models for the JobTech `/search` API. The CLI imports these directly. The HTTP layer wraps the retrieval primitives, not this client.
- `api/`: thin FastAPI layer. `app_factory()` mounts `routers/health.py`, `routers/jobs.py`, and `routers/engagements.py`. The lifespan warms the embedder once on startup. `POST /v1/jobs/search` and `POST /v1/jobs/semantic` back the `searchJobs` and `semanticSearch` tools. `POST /v1/jobs/details` returns description excerpts for one or more ad ids and serves both `matchProfile` and `compareRoles`. `POST /v1/jobs/triage` runs hybrid retrieval and returns ranked ads with description excerpts in one call for `triageBatch`. `POST /v1/jobs/deadline` filters active ads by application-deadline window for `deadlineWatch`. `GET /v1/engagements/status` reads the markdown engagement log via `engagement.read_status` for `trackStatus`. The CLI keeps importing the Python tools directly without going through HTTP. `JobSearchRequest.occupation_concept_id` validates against the JobTech 4-3-3 alphanumeric nanoid pattern and returns 422 on fabricated ids. `JOBTRIAGE_RRF_FLOOR` (default 0.025) drops below-floor results at the `triage` and `semantic` endpoints to suppress noise on adversarial queries. `filter_only_search` is left untouched since it returns recent ads regardless of relevance score.
- `storage/`: SQLite schema, paragraph-then-length chunker, append-mostly ingest with filter-scoped deactivation. Ingest writes both `ad_chunks` and `ad_chunks_fts` rows together.
- `embeddings.py`: `Embedder` Protocol plus `SentenceTransformerEmbedder` for multilingual-e5. Lazy-loads the model on first encode and applies the `passage:`/`query:` prefixes that e5 requires.
- `retrieval.py`: `bm25_search` over FTS5, `dense_search` over the embedding column, `reciprocal_rank_fusion` (k=60 default), and `hybrid_search` that composes them.
- `evals/`: pydantic-validated golden-set loader and a four-configuration runner (filter-only, bm25-only, dense-only, hybrid). Emits precision-at-k, recall@10, and p50/p95 latency. Adds an embedding-ablation runner that encodes chunks in memory per model and compares e5-base, e5-large, and `all-MiniLM-L6-v2` on dense and hybrid configurations without touching `ad_chunks.embedding`.
- `engagement.py`: `record_status` appends rows to a markdown engagement log, `read_status` parses entries for one ad id. Single-writer file, no SQLite mirror per ARCHITECTURE.md.
- `cli/`: Typer commands. `sweep` ingests from JobTech, `index` backfills embeddings, `search` runs hybrid retrieval, `evaluate` runs the four-configuration ablation harness, `evaluate-embeddings` runs the per-model encoder comparison, `mark-status` records engagement state.

## Conventions

- Strict mypy. Annotate every function. `uv init --app` ships an unannotated `main()` that fails on first run.
- Sidecar configs for ruff and mypy (`ruff.toml`, `mypy.ini`). pytest config lives inline under `[tool.pytest.ini_options]` in `pyproject.toml` because pytest has no sidecar precedence drift.
- `[project.scripts]` exposes `jobtriage` as the CLI entrypoint, installed via the hatchling build backend.
- Tests live under `tests/` with `pythonpath = src`. `asyncio_mode = "auto"` so `async def` tests run without per-test markers.

## Anti-patterns

- Do not use `pip` directly. Always go through `uv add`, `uv sync`, or `uv run`.
- Do not move `[tool.ruff]` or `[tool.mypy]` into `pyproject.toml`. Keep them sidecar to avoid silent precedence bugs.
- Do not pin Python via `[project] requires-python` and `.python-version` independently. Treat `.python-version` as the source of truth.
- Do not add `commitizen` for conventional commits. Root already ships commitlint plus husky.

## Commands

Run from `python/` after `cd python`.

| Command                                   | Purpose                            |
| ----------------------------------------- | ---------------------------------- |
| `uv sync`                                 | Install dependencies into `.venv/` |
| `uv add <pkg>`                            | Add a runtime dependency           |
| `uv add --dev <pkg>`                      | Add a dev dependency               |
| `uv run ruff check .`                     | Lint                               |
| `uv run ruff format .`                    | Auto-format                        |
| `uv run mypy .`                           | Strict typecheck                   |
| `uv run pytest -v`                        | Tests                              |
| `bash scripts/verify.sh`                  | Full python verify                 |
| `uv run jobtriage-api`                    | Start the FastAPI server           |
| `uv run python scripts/export_openapi.py` | Regenerate `openapi.json`          |

## Deploy

Fly.io free tier. Wired in v5. The SQLite ad corpus ships embedded in the container image. No external vector database, no external services beyond the Anthropic key the end user supplies.
