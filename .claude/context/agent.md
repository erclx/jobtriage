---
title: Agent
description: Tool registry, system prompt, provider switch, and deploy-vs-local posture
---

# Agent

The agent loop is the project's core IP and the most-edited surface. This entry consolidates the wiring rules across `web/src/lib/agent/`, `web/src/app/api/chat/route.ts`, and `web/scripts/model-probe.ts`. Decision-level rationale lives in `.claude/ARCHITECTURE.md` under "BYOK over a funded demo", "Live JobTech path in deploy", "Local Ollama for development", and "Tool decomposition over a single-prompt agent". This entry holds the operational wiring those decisions imply.

## Layer responsibilities

- `web/src/lib/agent/tools.ts` exports two tool registries. `jobtriageTools = {...dataTools, ...spatialTools}` for local mode covers the full seven data tools paired with eight spatial tools. `deployJobtriageTools = {...deployDataTools, ...spatialTools}` swaps the corpus-dependent data tools (`searchJobs`, `semanticSearch`, `triageBatch`, `deadlineWatch`) for live variants and adds `lookupConcept` as the setup gate.
- `web/src/lib/agent/system-prompt.ts` exports `buildSystemPrompt(profile, today, mode)`. Two base prompts (`LOCAL_BASE`, `DEPLOY_BASE`) carry the tool list and pairing rules per mode. Profile content sandwiches between `PROFILE_HEADER` and `PROFILE_FOOTER`. When `profile` is null or whitespace-only the sandwich is omitted entirely and the agent skips `connectProfileToAds`.
- `web/src/app/api/chat/route.ts` orchestrates per-request resolution. `resolveProvider(request)` reads `x-jobtriage-provider`, routes to Ollama factory or a BYOK builder. `resolveAgentMode(providerName, request)` reads `x-jobtriage-mode`. Tool selection is `mode === 'deploy' ? deployJobtriageTools : jobtriageTools`. The loop is hard-capped via `stopWhen: stepCountIs(8)`.
- `web/scripts/model-probe.ts` drives the chat route from outside, loads a `kind`-tagged fixture from `.claude/evals/`, and emits a markdown comparison per provider or per model. For Ollama, restarts the web server between model batches via `bun run restart:web` with `OLLAMA_MODEL_ID` set. For BYOK, no restart and requires `PROBE_API_KEY`. See `evals.md`.

## Decisions

### Tool registry split per posture

Local mode keeps the corpus tools because the maintainer's SQLite corpus is the right shape for daily personal triage. Deploy mode excludes corpus-dependent tools because a maintainer-curated corpus cannot serve any visitor's profile. The split is enforced at the registry layer, not at runtime. A deploy request never sees the corpus tools in the system prompt or in the SDK tool registry.

### Provider switch via header

`x-jobtriage-provider` selects the provider factory (`ollama`, `anthropic`, `openai`, `google`). Default is `anthropic`. The browser sends this header from the BYOK gate selection persisted in `SESSION_KEYS.provider`. BYOK providers require an `Authorization: Bearer <key>` header. Missing key returns 401. Per-provider model id defaults live in `web/src/app/api/chat/route.ts` and override via `ANTHROPIC_MODEL_ID`, `OPENAI_MODEL_ID`, `GEMINI_MODEL_ID`, `OLLAMA_MODEL_ID`.

### System-prompt fixes state the principle, not the examples

When tightening a model-behavior rule in `buildSystemPrompt`, write the principle alone. Do not list specific tokens or example phrases. Models treat example lists as literal whitelists, not instances of a rule, and the rule has to be rewritten on the next near-miss. Draft principle-only first. Add examples only if the principle alone fails the smoke probe set, and even then state them as criteria, not tokens.

### Mode resolution with a VERCEL gate

`resolveAgentMode` order:

1. If `x-jobtriage-mode: deploy` AND `!process.env.VERCEL`, mode is `deploy`. This lets the model-probe harness drive the deploy posture against a local Ollama branch.
2. Otherwise: Ollama maps to `local`, any other provider maps to `deploy`.

The `VERCEL` gate means a deployed visitor cannot force local mode by spoofing the header. The gate is one-way: deploy traffic is always deploy, local traffic can opt into deploy for testing.

## Gotchas

### Mode override is local-only

A local BYOK provider run defaults to `deploy` because the second branch in the resolver only sees Ollama as `local`. To run a local BYOK probe against the full corpus tool set, run with Ollama or accept that BYOK exercises the deploy posture locally.

### Step count hard cap

`stopWhen: stepCountIs(8)` halts the agent after 8 tool calls in a single turn. No override. Designed to fit local-model context windows. Long chains (lookupConcept then searchJobs then matchProfile then groupAds then connectProfileToAds then setView already burns six). If a feature needs more, audit pairing first.

### Spatial tools are echoes, not server work

Spatial tools (`placeAds`, `groupAds`, `connectProfileToAds`, `pairAdsForCompare`, `placeAdsOnTimeline`, `pinToShortlist`, `markStatus`, `setView`) never call the FastAPI backend. They are server-defined echoes whose `output-available` parts the client `CanvasBridge` translates into reducer dispatches. See `canvas.md` for the bridge contract.

### Authorization header is case-sensitive

`Authorization: Bearer <key>`, exactly. Missing or malformed returns 400 with the provider name in the error message. Do not surface key contents in any error path.

### JobTech API parameter quirks

JobTech `/search` filters occupation concept ids via `occupation-name`, not `occupation-concept-id`. The latter is silently ignored and returns the unfiltered global corpus. JobTech's taxonomy `suggesters/autocomplete` accepts one `type` per request, so cross-taxonomy lookups must fan out to parallel calls. When adding any new JobTech filter, hit the live endpoint and verify the response narrows. Do not trust parameter names from training data or from other endpoints in the same API.

## Hidden contracts

- `x-jobtriage-mode` default is empty, not `local`. The resolver falls through to step 2 when the header is absent or anything other than `deploy`.
- The system prompt is rebuilt per request, not cached. The `today` field is the request's date in ISO, so the date used in deadline reasoning is server-side and stable across the agent's loop.
- Profile content flows from the chat request body (`profile` field), not from a header or cookie. The browser pulls profile from `SESSION_KEYS.profile` and posts it inline. No persistence server-side.
- Endpoint mapping for the seven local data tools: `searchJobs` and `semanticSearch` hit `/v1/jobs/search` and `/v1/jobs/semantic`. `matchProfile` and `compareRoles` share `/v1/jobs/details`. `triageBatch` calls `/v1/jobs/triage`. `deadlineWatch` calls `/v1/jobs/deadline`. `trackStatus` reads `GET /v1/engagements/status`. The deploy posture remaps `searchJobs` to `/v1/jobs/live-search`, `matchProfile` and `compareRoles` to `/v1/jobs/live-details`, and adds `lookupConcept` against `/v1/taxonomy/lookup`. See `python.md` for backend route ownership.
