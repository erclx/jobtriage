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

The chat shell runs in the browser via `useChat`, with `streamText` on a thin Next.js route handler that forwards the user-supplied Anthropic key via `Authorization: Bearer`. Tool registration, streaming, and tool-call traces all come from the AI SDK. Provider switching is a one-line change between `ollama-ai-provider` and `@ai-sdk/anthropic`. The Claude Agent SDK would push the loop into a long-running service, complicating tool-trace rendering and adding ops surface.

### Hybrid retrieval over single-mode

Dense embeddings alone miss exact keyword matches like model names ("Mastra", "LangGraph"). BM25 alone misses paraphrased semantics. Reciprocal rank fusion over both lists, plus an optional cross-encoder rerank, balances recall and precision. The README ships an ablation table comparing JobTech filter alone, BM25 alone, dense alone, and the hybrid.

### SQLite over an external vector database

FTS5 for keywords and a numpy in-process cosine over a chunk-level embedding column for vectors. One file, no extra service, ships embedded in the Fly.io image. External vector DBs add deploy complexity and a network hop. Active ad volume (low thousands at a time) sits well within SQLite's range, and brute-force scan is sub-millisecond at that size. `sqlite-vec` stays on the path for when corpus growth makes brute force unprofitable.

### Two-folder repo over a workspace monorepo

The boundary between Python and TypeScript is HTTP, not in-process imports. Workspaces would buy nothing here. Two sibling folders share a git history and root CI without lockfile coordination overhead.

### BYOK over a funded demo

The maintainer cannot fund every visitor's API spend. End users supply their own Anthropic key at chat time, held in browser sessionStorage and sent with each request, never persisted server-side. Tradeoff: lower demo conversion than a one-click flow. A landing-page screencast is the fallback for visitors without a key.

### Live JobTech path in deploy, hybrid retrieval in repo and CLI

The deployed demo cannot ship a maintainer-curated SQLite corpus and still serve any visitor's profile, since a corpus pre-swept against AI engineering filters returns nothing for a nurse or a marketer. The deploy provider branch therefore excludes the corpus-dependent tools (`semanticSearch`, `triageBatch`, `deadlineWatch`) from the registered tool set and leans on `searchJobs` against JobTech live, plus `matchProfile` and `compareRoles` in-context over the returned ads. A `lookupConcept` tool resolves user-facing terms to JobTech taxonomy concept_ids so the agent can map "nursing in Stockholm" to a real query without fabricating ids.

Hybrid retrieval stays intact for the local CLI and the local browser dev surface, where the maintainer's own corpus is the right shape for daily personal triage. The README ablation table and the multilingual comparison continue to ship as the repo and CLI story. The deployed demo's pitch shifts from "hybrid retrieval over Swedish description text" to "agent-driven triage with spatial canvas", since recruiters who only click the live URL never see the retrieval path.

The mode resolves in `web/src/app/api/chat/route.ts` next to `resolveProvider`. Local Ollama maps to `local` (the full seven-tool corpus stack). Any other provider maps to `deploy` (four data tools plus `trackStatus`). `lookupConcept` is the bridge tool that resolves user-facing terms ("nursing", "Stockholm") to JobTech taxonomy concept ids across the occupation and region taxonomies in one call, with a `type` field on each result so the agent routes the id into the correct `searchJobs` field. In deploy mode the live `searchJobs` returns description excerpts inline so the chain stays at lookupConcept then searchJobs in two real network hops, with `matchProfile` and `compareRoles` reserved for follow-up reasoning over surfaced ads. The model-probe harness can drive the deploy posture against the local Ollama branch via an `x-jobtriage-mode: deploy` request header. The override is gated on the absence of `process.env.VERCEL` (Vercel sets it automatically) so a deployed visitor cannot force the posture, while a local `next start` build still honors it.

### Local Ollama for development

`gemma4:26b` via Ollama drives the entire agent loop in dev. Zero API spend during the bulk of the build. Anthropic only for the deployed demo and for nightly eval smoke tests on a capped maintainer key. Tradeoff: local model quality differs from Claude. The eval harness compares both runs to catch prompt-portability issues before deploy.

The provider switch is exposed in the UI. The BYOK gate offers two paths: paste an Anthropic key, or click "Use local Ollama" to route through `ollama-ai-provider-v2`. The chosen provider is persisted in browser sessionStorage and forwarded to `/api/chat` via the `x-jobtriage-provider` header. The route handler instantiates the matching provider per request. The Ollama model id is `gemma4:26b` by default and overridable through the `OLLAMA_MODEL_ID` environment variable so a workstation can A/B against other local models (`gemma4:31b`, `mistral-small3.2:24b`, `qwen3:32b`) without a code edit.

`gemma4:26b` was chosen over the prior `qwen3-coder:30b` after a six-model A/B smoke run via `web/scripts/model-probe.ts`. The coder variant fired retrieval tools on conversational turns (3/5 false-positives on "hi", "what can you do", "how are you"), a known limitation of the agentic-coder RL training. Gemma 4 26B (MoE 25.2B/3.8B-active) hit 0/5 chitchat false-positives plus 3/3 tool-warranted correct at 2.6 s avg latency, beat the dense `gemma4:31b` on speed at the same accuracy, and beat `mistral-small3.2:24b` and `qwen3:32b` on tool selection. The two latter models mis-fired `searchJobs` without a JobTech concept_id, a system-prompt rule violation. `qwen3:30b` was disqualified for leaking thinking-channel content into chat output. The smoke harness lives at `web/scripts/model-probe.ts` for re-running on future model swaps.

The Ollama branch sets `num_ctx` to 8192 by default via `providerOptions`, overridable through `OLLAMA_NUM_CTX`. Ollama's stock 131k context window allocates a KV cache that spills past WSL2's memory cap into Windows host RAM under inference, freezing the desktop. The 8192 floor fits the agent loop with multi-turn tool calls and keeps the cache resident in VRAM.

### Tool decomposition over a single-prompt agent

Seven distinct tools with focused responsibilities: `searchJobs`, `semanticSearch`, `matchProfile`, `triageBatch`, `compareRoles`, `deadlineWatch`, `trackStatus`. RAG lives only inside `semanticSearch` and `triageBatch`, where description-text semantics earn it. Other tools call the API or the matcher directly. Tool-call traces in the chat UI make reasoning auditable.

The TypeScript wrappers map onto five FastAPI endpoints. `searchJobs` and `semanticSearch` keep their v2 endpoints (`/v1/jobs/search`, `/v1/jobs/semantic`). `matchProfile` and `compareRoles` share `/v1/jobs/details`, which returns description excerpts so the LLM scores fit against the system-prompt profile block. `triageBatch` calls `/v1/jobs/triage`, which runs hybrid retrieval and returns ranked ads with description excerpts in one round trip. `deadlineWatch` calls `/v1/jobs/deadline`, which filters active ads by application deadline window. `trackStatus` calls `GET /v1/engagements/status`, which reads the markdown engagement log via `read_status` and returns an empty list on the deployed image (where no log is mounted).

### Per-session profile input over a hardcoded profile

Profile markdown is a tool input, not embedded in the deploy image. The web pastes profile content into chat (browser sessionStorage). The CLI accepts a `--profile <path>` flag pointing at any local markdown file. No personal data baked into the public repo or the deployed container.

### Spatial tool layer over inline cards

Retrieved ads render as nodes on a React Flow canvas to the right of the chat rail rather than as cards inline in the conversation. Eight spatial tools (`placeAds`, `groupAds`, `connectProfileToAds`, `pairAdsForCompare`, `placeAdsOnTimeline`, `pinToShortlist`, `markStatus`, `setView`) are registered with the AI SDK alongside the seven data tools. Spatial tools never call the FastAPI backend. They are server-defined echoes whose `output-available` parts the client `CanvasBridge` translates into reducer dispatches against `CanvasContext`.

The agent calls at least one spatial tool after each data tool in the same turn. The default pairings are fixed by the system prompt:

| Data tool                      | Spatial tool                                   |
| ------------------------------ | ---------------------------------------------- |
| `searchJobs`, `semanticSearch` | `placeAds`                                     |
| `triageBatch`                  | `groupAds` (or `placeAds` when no clear tiers) |
| `matchProfile`                 | `connectProfileToAds`                          |
| `compareRoles`                 | `pairAdsForCompare`                            |
| `deadlineWatch`                | `placeAdsOnTimeline`                           |
| `trackStatus`                  | `markStatus`                                   |

Profile-fit intent stacks two spatial calls. When the user references themselves, their profile, or "fits me" / "best for me", and a profile is saved, the agent calls `connectProfileToAds` in addition to the default pairing. The Triage view supports clusters and edges simultaneously, so `groupAds` plus `connectProfileToAds` after `triageBatch` is the canonical profile-fit composition. When no profile is saved, the agent skips `connectProfileToAds` and asks the user to add one.

Layout strategies live client-side in `web/src/features/canvas/views/layout.ts`. The agent picks `layout: "grid" | "stack"` and an emphasis hint, never pixel coordinates. User drag overrides persist in `state.nodePositions` and survive view switches. The full canvas state hydrates from sessionStorage on first render and writes through on every reducer step.

Chat messages mirror the same pattern. `useChat` hydrates from `jobtriage:chat-messages` once on mount and writes the messages array to sessionStorage when `status === 'ready'`, so a refresh during streaming cannot restore a half-finished assistant turn. A header `New chat` action behind a confirmation dialog clears chat plus canvas plus pinned shortlist, leaving profile and provider untouched. Switching provider clears chat plus canvas in addition to rotating the key.

Pinning stays client-side. The deployed web demo never writes back to `engagements/log.md`. The Typer CLI continues to be the only path that mutates the canonical engagement log, preserving the stateless deploy posture.

### Triage state in a local file, not in SQLite

The CLI's `mark-status` command writes to a local `engagements/log.md` (or any markdown file the user picks). Git provides free history and rollback. SQLite is reserved for the shared ad corpus. The web demo is read-only and stateless. This keeps multi-tenant complexity out of the architecture.

### Voice input via the browser-native Web Speech API

The chat input ships a mic toggle in Chrome that streams partial transcripts into the textarea via `window.SpeechRecognition || window.webkitSpeechRecognition`. Pure client-side, no server hop, no API key, no Whisper dependency. The toggle commits the finalized transcript on stop. Escape calls `abort()` so it stops without firing the final-result rewrite that would flicker capitalization and punctuation into the textarea.

The button hides cleanly on browsers without `SpeechRecognition` (Firefox, Safari) so unsupported visitors do not see a broken affordance. Chromium covers roughly 70% of desktop traffic, which is enough to justify shipping the path while leaving the door open for a Whisper-on-server fallback later. Tradeoff: the typed prefix at listen-start is preserved by snapshotting the input value, but typing while listening is clobbered by the next interim event. v1 by design.

## Risks / open questions

- **Tool-call trace UI density**: resolved at v4. Cards always render above the trace tree. The trace tree is collapsed by default behind a one-line summary header like `Triaged batch · Completed`. Recruiters get a clean transcript by default. Engineers expand per-tool to inspect inputs and outputs.
- **Multilingual embedding ablation timing**: resolved at v5.2. The three-model comparison (e5-base, e5-large, `all-MiniLM-L6-v2` as the English-only baseline) runs through the harness via a separate `evaluate-embeddings` CLI on a 50-query Swedish golden set. The canonical pipeline still indexes with e5-base. The ablation encodes chunks in memory per model so it does not disturb `var/jobtriage.db`. README publishes both tables side by side.
- **Eval cadence**: resolved at v2. Nightly via GitHub Actions cron at 03:00 UTC, with a `workflow_dispatch` escape hatch. The current eval harness is pure retrieval and does not call an LLM, so the API-budget concern does not apply yet. When v3 introduces LLM tool calls, split the LLM-eval subset into a dispatch-only or weekly job to cap the maintainer key.
- **Ad corpus freshness in deploy** (decide at v5): rebuild the SQLite file and redeploy nightly, or run ingestion inside the container with a persistent Fly.io volume.
- **Reranker on or off by default**: shipped off and deferred out of v1. The retrieval module exposes a clean seam so a cross-encoder rerank can land later without churn. Decision flips at the start of v2 once `evaluate` produces baseline precision numbers against a real golden set.

### RRF score floor at the triage and semantic boundaries

Hybrid retrieval has no zero-result floor by default, so adversarial queries return tangentially-relevant ads at very low RRF scores. The v4.2 audit caught this on a "quantum welding theologian" prompt that surfaced ten Volvo ads at score around 0.03. A score floor at the API boundary suppresses noise without changing the underlying ranking math. Exposed as the `JOBTRIAGE_RRF_FLOOR` setting (default 0.025) since RRF scores are corpus-size-dependent and a hardcoded threshold locks future tuning. Applied at `triageBatch` and `semanticSearch` only. `filter_only_search` is left untouched since it is supposed to return recent ads regardless of relevance score.

### JobTech concept-id format validation at the API boundary

`searchJobs` accepts an `occupation_concept_id` filter that maps to JobTech's taxonomy nanoid format (4-3-3 alphanumeric segments separated by underscores, e.g. `X9jv_K2b_m48`). The v4.2 audit caught the agent fabricating ids like `occupation-12345` on adversarial prompts. The fabricated id silently returned empty results because no constraint enforced the format. The fix validates the format at the `JobSearchRequest` schema and returns a 422 with an actionable message. The model recovers from a structured error into a different tool, instead of looking like the corpus has no matches.
