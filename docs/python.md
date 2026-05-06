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
- SQLite plus `sqlite-vec` for vector storage, FTS5 for keyword index
- `intfloat/multilingual-e5-base` for embeddings (v1)
- `httpx` for the JobTech API client
- `ruff` for lint and format, `mypy` for strict types, `pytest` for tests

Typer, httpx, pydantic, and pydantic-settings ship with v0. FastAPI, sqlite-vec, and the embedding model land in v1 and v2 per [ARCHITECTURE.md](../.claude/ARCHITECTURE.md).

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
│       ├── api/                ← FastAPI app and routers (planned, v2)
│       ├── jobtech/            ← async JobTech client + pydantic models
│       ├── storage/            ← SQLite schema, chunker, append-mostly ingest
│       └── cli/                ← Typer entrypoint with sweep + mark-status
├── tests/                      ← pytest, mirrors src/ layout
├── scripts/
│   └── verify.sh               ← Python verify (ruff, mypy, pytest)
├── .python-version             ← 3.12
├── pyproject.toml              ← project + [dependency-groups] dev + hatchling
├── ruff.toml
├── mypy.ini
├── pytest.ini
└── .coveragerc
```

`api/` lands in v2. The `storage/` schema reserves a nullable `embedding` BLOB column on `ad_chunks` so v1 can backfill without a migration.

## Layer responsibilities

- `jobtech/`: async httpx client and pydantic models for the JobTech `/search` API. The CLI imports these directly. The API layer (v2) will wrap them as HTTP endpoints.
- `api/`: thin FastAPI layer. One endpoint per TypeScript tool wrapper in `web/src/lib/tools/` (planned, v2).
- `storage/`: SQLite schema, paragraph-then-length chunker, append-mostly ingest with filter-scoped deactivation. Hybrid retriever (dense + BM25 + reciprocal rank fusion) lands in v1.
- `engagement.py`: appends rows to a markdown engagement log. Single-writer file, no SQLite mirror per ARCHITECTURE.md.
- `cli/`: Typer commands. `sweep` runs a structured filter and persists results. `mark-status` records engagement state.

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

| Command                  | Purpose                            |
| ------------------------ | ---------------------------------- |
| `uv sync`                | Install dependencies into `.venv/` |
| `uv add <pkg>`           | Add a runtime dependency           |
| `uv add --dev <pkg>`     | Add a dev dependency               |
| `uv run ruff check .`    | Lint                               |
| `uv run ruff format .`   | Auto-format                        |
| `uv run mypy .`          | Strict typecheck                   |
| `uv run pytest -v`       | Tests                              |
| `bash scripts/verify.sh` | Full python verify                 |

## Deploy

Fly.io free tier. Wired in v5. The SQLite ad corpus ships embedded in the container image. No external vector database, no external services beyond the Anthropic key the end user supplies.
