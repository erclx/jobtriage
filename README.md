# jobtriage

A free-form chat agent over the Swedish JobTech (Platsbanken) job board. Combines structured API filters, hybrid retrieval over Swedish description text, and per-session profile reasoning to answer questions like "which Stockholm AI roles mention agentic systems and have a deadline before next Friday".

## Features

- Structured search by occupation code, region, employer, deadline
- Hybrid retrieval over Swedish ad descriptions (dense + BM25 + reciprocal rank fusion)
- Per-session profile match with rationale
- Triage batch, compare roles, deadline watch, and CLI status tracking
- Tool-call traces visible in the chat UI

## Layout

- `web/`: Next.js 16 app with the agent loop in the browser via the Vercel AI SDK
- `python/`: FastAPI backend wrapping the tools, plus a Typer CLI
- `docs/`: development workflow and CI reference
- `.claude/`: planning docs

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

# Web dev server
cd web && bun run dev
```

## Documentation

- [Development workflow](docs/development.md) covers the verify cascade, scripts, and husky hooks.
- [Web stack](docs/web.md) covers Next.js layout, conventions, and scripts.
- [Python stack](docs/python.md) covers the FastAPI/CLI layout, conventions, and uv commands.
- [CI reference](docs/ci.md) describes the parallel job structure on GitHub Actions.
- [Architecture](.claude/ARCHITECTURE.md) documents the five-layer request flow and key technical decisions.
- [Requirements](.claude/REQUIREMENTS.md) describes the problem, MVP features, and constraints.
