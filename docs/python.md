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

FastAPI, Typer, sqlite-vec, and the embedding model are not yet installed. They land per the v0 through v2 phases in [ARCHITECTURE.md](../.claude/ARCHITECTURE.md).

## Layout

```plaintext
python/
├── src/
│   └── jobtriage/
│       ├── __init__.py
│       ├── api/                ← FastAPI app and routers (planned, v2)
│       ├── tools/              ← JobTech client, retriever, matcher (planned, v0-v1)
│       ├── storage/            ← SQLite + sqlite-vec + FTS5 (planned, v0)
│       └── cli/                ← Typer entrypoint (planned, v0)
├── tests/                      ← pytest tests
│   └── test_smoke.py
├── scripts/
│   └── verify.sh               ← Python verify (ruff, mypy, pytest)
├── .python-version             ← 3.12
├── pyproject.toml              ← project + [dependency-groups] dev
├── ruff.toml
├── mypy.ini
├── pytest.ini
└── .coveragerc
```

Only `src/jobtriage/__init__.py` exists today. Subpackages land at their phase per ARCHITECTURE.md.

## Layer responsibilities

- `tools/`: pure Python with no FastAPI coupling. The CLI imports these directly. The API layer wraps them as HTTP endpoints.
- `api/`: thin FastAPI layer. One endpoint per TypeScript tool wrapper in `web/src/lib/tools/`.
- `storage/`: SQLite schema, ingestion, hybrid retriever (dense + BM25 + reciprocal rank fusion).
- `cli/`: Typer commands for sweeps, ingestion, and `mark-status` writes against a local engagement markdown file.

## Conventions

- Strict mypy. Annotate every function. `uv init --app` ships an unannotated `main()` that fails on first run.
- Sidecar configs for ruff and mypy (`ruff.toml`, `mypy.ini`). pytest config lives inline under `[tool.pytest.ini_options]` in `pyproject.toml` because pytest has no sidecar precedence drift.
- `[project.scripts]` exposes `jobtriage` as the CLI entrypoint once `cli/__init__.py` is wired (v0).
- Tests live under `tests/` with `pythonpath = src`.

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
