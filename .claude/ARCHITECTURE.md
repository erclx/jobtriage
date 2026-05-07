# Architecture

## Overview

Two-folder layout: `web/` runs a Next.js app with the agent loop in the browser, and `python/` runs a FastAPI backend wrapping the actual tools. The frontend orchestrates the LLM via the Vercel AI SDK and calls FastAPI endpoints when tools execute. SQLite holds the shared ad corpus and ships embedded with the deployed Fly.io image. A separate Typer CLI imports the same Python tools directly, bypassing the web shell for local daily use.

Five layers, in request-flow order:

1. Web shell (Next.js plus AI Elements chat components)
2. Agent shell (Vercel AI SDK, registers tools and runs the agent loop)
3. Tool definitions (TypeScript wrappers that post to FastAPI)
4. Backend (FastAPI HTTP layer)
5. Tools implementation (Python: JobTech client, hybrid retriever, criteria matcher) plus storage (SQLite with sqlite-vec and FTS5)

The CLI sits beside layers 4 and 5, importing the Python modules directly with no HTTP hop.

## Key technical decisions

### Vercel AI SDK over Claude Agent SDK

The agent loop runs in the browser. Tool registration, streaming, and tool-call traces all come from the AI SDK. Provider switching is a one-line change between `ollama-ai-provider` and `@ai-sdk/anthropic`. The Claude Agent SDK would push the loop server-side, complicating tool-trace rendering and adding a service to operate.

### Hybrid retrieval over single-mode

Dense embeddings alone miss exact keyword matches like model names ("Mastra", "LangGraph"). BM25 alone misses paraphrased semantics. Reciprocal rank fusion over both lists, plus an optional cross-encoder rerank, balances recall and precision. The README ships an ablation table comparing JobTech filter alone, BM25 alone, dense alone, and the hybrid.

### SQLite over an external vector database

FTS5 for keywords and a numpy in-process cosine over a chunk-level embedding column for vectors. One file, no extra service, ships embedded in the Fly.io image. External vector DBs add deploy complexity and a network hop. Active ad volume (low thousands at a time) sits well within SQLite's range, and brute-force scan is sub-millisecond at that size. `sqlite-vec` stays on the path for when corpus growth makes brute force unprofitable.

### Two-folder repo over a workspace monorepo

The boundary between Python and TypeScript is HTTP, not in-process imports. Workspaces would buy nothing here. Two sibling folders share a git history and root CI without lockfile coordination overhead.

### BYOK over a funded demo

The maintainer cannot fund every visitor's API spend. End users supply their own Anthropic key at chat time, held in browser sessionStorage and sent with each request, never persisted server-side. Tradeoff: lower demo conversion than a one-click flow. A landing-page screencast is the fallback for visitors without a key.

### Local Ollama for development

`qwen3-coder:30b` via Ollama drives the entire agent loop in dev. Zero API spend during the bulk of the build. Anthropic only for the deployed demo and for nightly eval smoke tests on a capped maintainer key. Tradeoff: local model quality differs from Claude. The eval harness compares both runs to catch prompt-portability issues before deploy.

### Tool decomposition over a single-prompt agent

Seven distinct tools with focused responsibilities: `searchJobs`, `semanticSearch`, `matchProfile`, `triageBatch`, `compareRoles`, `deadlineWatch`, `trackStatus`. RAG lives only inside `semanticSearch` and `triageBatch`, where description-text semantics earn it. Other tools call the API or the matcher directly. Tool-call traces in the chat UI make reasoning auditable.

### Per-session profile input over a hardcoded profile

Profile markdown is a tool input, not embedded in the deploy image. The web pastes profile content into chat (browser sessionStorage). The CLI accepts a `--profile <path>` flag pointing at any local markdown file. No personal data baked into the public repo or the deployed container.

### Triage state in a local file, not in SQLite

The CLI's `mark-status` command writes to a local `engagements/log.md` (or any markdown file the user picks). Git provides free history and rollback. SQLite is reserved for the shared ad corpus. The web demo is read-only and stateless. This keeps multi-tenant complexity out of the architecture.

## Risks / open questions

- **Tool-call trace UI density** (decide at v4): expandable trees open by default (educational, busy) versus collapsed (cleaner) versus behind a toggle.
- **Multilingual embedding ablation timing**: deferred to v1.5. v1 ships with `multilingual-e5-base` only and the four-configuration hybrid ablation. The model comparison (e5-base vs e5-large vs English-only) runs through the same harness once the golden set carries live ad ids.
- **Eval cadence** (decide at v2): nightly via GitHub Actions cron is the likely call, but burns API budget on the maintainer's capped key.
- **Ad corpus freshness in deploy** (decide at v5): rebuild the SQLite file and redeploy nightly, or run ingestion inside the container with a persistent Fly.io volume.
- **Reranker on or off by default**: shipped off and deferred out of v1. The retrieval module exposes a clean seam so a cross-encoder rerank can land later without churn. Decision flips at the start of v2 once `evaluate` produces baseline precision numbers against a real golden set.
