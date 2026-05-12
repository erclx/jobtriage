# Architecture

Decisions and rationale. Operational wiring lives in `.claude/context/` per domain. Decision-level prose only here.

## Overview

Two-folder layout: `web/` runs a Next.js app with the agent loop in the browser, and `python/` runs a FastAPI backend wrapping the actual tools. The frontend orchestrates the LLM via the Vercel AI SDK and calls FastAPI endpoints when tools execute. SQLite holds the shared ad corpus for the local CLI and dev surface. The deployed Cloud Run image is slim and skips the corpus, since v4.10's live JobTech path renders corpus-backed tools unused in production. A separate Typer CLI imports the same Python tools directly, bypassing the web shell for local daily use.

Five layers, in request-flow order:

1. Web shell (Next.js plus AI Elements chat components)
2. Agent shell (Vercel AI SDK, registers tools and runs the agent loop)
3. Tool definitions (TypeScript wrappers that post to FastAPI)
4. Backend (FastAPI HTTP layer)
5. Tools implementation (Python: JobTech client, hybrid retriever, criteria matcher) plus storage (SQLite with sqlite-vec and FTS5)

The CLI sits beside layers 4 and 5, importing the Python modules directly with no HTTP hop.

## Key technical decisions

### Vercel AI SDK over Claude Agent SDK

The chat shell runs in the browser via `useChat`, with `streamText` on a thin Next.js route handler. Tool registration, streaming, and tool-call traces all come from the AI SDK. Provider switching is a one-line change. The Claude Agent SDK would push the loop into a long-running service, complicating tool-trace rendering and adding ops surface.

### Hybrid retrieval over single-mode

Dense embeddings alone miss exact keyword matches like model names ("Mastra", "LangGraph"). BM25 alone misses paraphrased semantics. Reciprocal rank fusion over both lists, plus an optional cross-encoder rerank, balances recall and precision. The README ships an ablation table comparing JobTech filter alone, BM25 alone, dense alone, and the hybrid.

### SQLite over an external vector database

FTS5 for keywords and a numpy in-process cosine over a chunk-level embedding column for vectors. One file, no extra service, used by the CLI and the local browser dev surface. External vector DBs add deploy complexity and a network hop. Active ad volume sits well within SQLite's range and brute-force scan is sub-millisecond at that size. `sqlite-vec` stays on the path for when corpus growth makes brute force unprofitable.

### Two-folder repo over a workspace monorepo

The boundary between Python and TypeScript is HTTP, not in-process imports. Workspaces would buy nothing here. Two sibling folders share a git history and root CI without lockfile coordination overhead.

### BYOK over a funded demo

The maintainer cannot fund every visitor's API spend. End users supply their own Anthropic, OpenAI, or Gemini key at chat time, held in browser sessionStorage and sent with each request, never persisted server-side. The gate exposes a provider picker that defaults to Anthropic and surfaces Gemini's free tier as the lowest-friction onramp for first-time visitors. The maintainer-funded nightly LLM eval runs behind `workflow_dispatch` only so the cap stays intact. Tradeoff: lower demo conversion than a one-click flow. Operational wiring (header semantics, env var defaults, per-provider routing) lives in `.claude/context/agent.md`.

### Mock demo posture as a third provider

A no-key visitor lands on the live URL and would otherwise bounce at the BYOK gate. The gate surfaces a "Try the demo, no key" button that sets the provider to `mock` and skips the key field. The route handler short-circuits the mock branch before key validation. It matches the latest user prompt against a fixture index and streams pre-canned SSE chunks (`text-delta`, `tool-input-available`, `tool-output-available`) that the chat trace and canvas bridge consume without branching. Free-form input is read-only in mock mode with an explicit "Switch to BYOK" affordance. Fixtures live as typed TS modules under `web/src/features/mock/scripts/`, captured from live JobTech via `web/scripts/capture-mock-fixtures.ts` against the same response shape the deploy posture returns. Per-chip profiles auto-populate so the canvas profile node has content. Switching from mock to BYOK or Ollama clears the auto-populated profile so demo scaffolding does not leak into a real session.

The four demo chips render as a persistent strip above the prompt input so a visitor can swap demos without a "New chat" round-trip. Tried chips drop off the strip in session-only React state. After all four fire, the strip flips to a terminal CTA with a primary "Switch to BYOK" button and a "Start over" reset. This makes the demo a guided walkthrough of all four canvas views (Triage, grouped Triage, Compare, Timeline) and ends on the BYOK conversion moment.

### Live JobTech path in deploy, hybrid retrieval in repo and CLI

The deployed demo cannot ship a maintainer-curated SQLite corpus and still serve any visitor's profile, since a corpus pre-swept against AI engineering filters returns nothing for a nurse or a marketer. The deploy provider branch therefore excludes the corpus-dependent tools (`semanticSearch`, `triageBatch`, `deadlineWatch`) from the registered tool set and leans on `searchJobs` against JobTech live, plus `matchProfile` and `compareRoles` in-context over the returned ads. A `lookupConcept` tool resolves user-facing terms to JobTech taxonomy concept ids so the agent can map "nursing in Stockholm" to a real query without fabricating ids.

Hybrid retrieval stays intact for the local CLI and the local browser dev surface, where the maintainer's own corpus is the right shape for daily personal triage. The README ablation table and the multilingual comparison continue to ship as the repo and CLI story. The deployed demo's pitch shifts from "hybrid retrieval over Swedish description text" to "agent-driven triage with spatial canvas", since recruiters who only click the live URL never see the retrieval path. Mode resolution, the `VERCEL` gate, and the `x-jobtriage-mode` override live in `.claude/context/agent.md`.

### Local Ollama for development

Ollama drives the entire agent loop in dev. Zero API spend during the bulk of the build. Anthropic only for the deployed demo and for nightly eval smoke tests on a capped maintainer key. Tradeoff: local model quality differs from Claude. The eval harness compares both runs to catch prompt-portability issues before deploy. Current model choice, the six-model bake-off history, and the `num_ctx` WSL2 workaround live in `.claude/context/evals.md` and `.claude/context/development.md`.

### Tool decomposition over a single-prompt agent

Seven distinct tools with focused responsibilities: `searchJobs`, `semanticSearch`, `matchProfile`, `triageBatch`, `compareRoles`, `deadlineWatch`, `trackStatus`. RAG lives only inside `semanticSearch` and `triageBatch`, where description-text semantics earn it. Other tools call the API or the matcher directly. Tool-call traces in the chat UI make reasoning auditable. The TypeScript-wrapper-to-endpoint mapping lives in `.claude/context/agent.md` and `.claude/context/python.md`.

### Per-session profile input over a hardcoded profile

Profile markdown is a tool input, not embedded in the deploy image. The web pastes profile content into chat (browser sessionStorage). The CLI accepts a `--profile <path>` flag pointing at any local markdown file. No personal data baked into the public repo or the deployed container.

### Spatial tool layer over inline cards

Retrieved ads render as nodes on a React Flow canvas to the right of the chat rail rather than as cards inline in the conversation. Eight spatial tools are registered with the AI SDK alongside the seven data tools. Spatial tools never call the FastAPI backend. They are server-defined echoes whose `output-available` parts the client `CanvasBridge` translates into reducer dispatches against `CanvasContext`. The agent picks a layout strategy and emphasis hint, never pixel coordinates. The data-spatial pairing rules, sessionStorage hydration, pinning policy, and `New chat` clearing semantics live in `.claude/context/canvas.md`.

### Triage state in a local file, not in SQLite

The CLI's `mark-status` command writes to a local `engagements/log.md` (or any markdown file the user picks). Git provides free history and rollback. SQLite is reserved for the shared ad corpus. The web demo is read-only and stateless. This keeps multi-tenant complexity out of the architecture.

### Voice input via the browser-native Web Speech API

The chat input ships a mic toggle in Chrome that streams partial transcripts into the textarea via `window.SpeechRecognition || window.webkitSpeechRecognition`. Pure client-side, no server hop, no API key, no Whisper dependency. The button hides cleanly on browsers without `SpeechRecognition` so unsupported visitors do not see a broken affordance. Chromium covers roughly 70% of desktop traffic, which is enough to justify shipping the path while leaving the door open for a Whisper-on-server fallback later. Tradeoff: typing while listening is clobbered by the next interim event. v1 by design.

## Decision history

Resolved questions from prior versions, kept as a changelog.

- **Tool-call trace UI density** (v4): cards always render above the trace tree, which collapses by default behind a one-line summary header. Recruiters get a clean transcript by default. Engineers expand per-tool.
- **Multilingual embedding ablation timing** (v5.2): three-model comparison runs through a separate `evaluate-embeddings` CLI on a 50-query Swedish golden set. README publishes both tables side by side. See `.claude/context/evals.md`.
- **Eval cadence** (v2): nightly via GitHub Actions cron at 03:00 UTC with a `workflow_dispatch` escape hatch. The LLM-eval subset is dispatch-only to cap the maintainer key.
- **Ad corpus freshness in deploy** (v5): the Cloud Run image ships in slim mode and omits the SQLite corpus and sentence-transformers entirely. Corpus-dependent endpoints return 503 in slim mode.
- **Reranker on or off by default** (v1): shipped off. The retrieval module exposes a clean seam so a cross-encoder rerank can land later without churn.
- **RRF score floor** (v4.2): hybrid retrieval had no zero-result floor and adversarial queries returned tangentially-relevant ads at very low scores. A floor at the API boundary suppresses noise without changing ranking math, exposed via `JOBTRIAGE_RRF_FLOOR` (default 0.025), applied at `triageBatch` and `semanticSearch`. Details in `.claude/context/retrieval.md`.
- **JobTech concept-id format validation** (v4.2): the agent fabricated ids on adversarial prompts and the upstream silently returned empty results. The fix validates the JobTech nanoid format at the request schema and returns a 422 with an actionable message. Details in `.claude/context/python.md`.
