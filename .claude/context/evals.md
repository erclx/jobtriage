---
title: Evals
description: Retrieval ablation harness and agent-eval fixtures, two separate stacks
---

# Evals

Two unrelated eval stacks sit under one name. Do not assume changes in one affect the other. Retrieval ablation runs in Python over a Swedish golden set. Agent eval runs in TypeScript driving the chat route against fixture JSON. Both ship their own metrics into README ablation tables.

## Stack 1: Retrieval ablation

### Layer responsibilities

- `python/src/jobtriage/evals/golden.py` loads a YAML golden set into a Pydantic model with `query`, `expected_ad_ids`, and an optional `note`.
- `python/src/jobtriage/evals/harness.py` owns the four-configuration runner: filter-only, BM25-only, dense-only, hybrid. Metrics per config: precision@1, precision@5, precision@10, recall@10, p50 latency, p95 latency.
- `python/src/jobtriage/evals/embedding_ablation.py` (separate runner) encodes chunks in memory per model and ranks via cosine similarity. Loads chunks once, runs three models (e5-base default, e5-large, MiniLM English baseline) with explicit `gc.collect()` between models. Zero database writes. `ad_chunks.embedding` stays untouched.
- `python/src/jobtriage/cli/evaluate.py` is the `evaluate` Typer command. Loads YAML, instantiates `SentenceTransformerEmbedder`, runs four configs, renders markdown, optionally writes JSON.
- `python/src/jobtriage/cli/evaluate_embeddings.py` is the `evaluate-embeddings` Typer command. Three-model dense plus hybrid ablation. Output goes into the multilingual table in the README.

### Commands

Run from `python/` after `cd python`:

```bash
uv run jobtriage evaluate --golden <path> --model <model-id> [--db <path>] [--json-out <path>]
uv run jobtriage evaluate-embeddings --golden <path> [--db <path>] [--json-out <path>]
```

### Gotchas

- The eval harness is pure retrieval and does not call an LLM. The nightly `eval.yml` workflow runs at 03:00 UTC and skips when no SQLite corpus is present in the runner.
- In-memory ablation cannot mutate `ad_chunks.embedding`. The canonical pipeline still indexes with e5-base. The ablation is read-only.

## Stack 2: Agent eval

### Layer responsibilities

- `web/scripts/model-probe.ts` is the fixture-agnostic driver. Loads a JSON fixture, dispatches probes by `kind` field, emits one markdown table per provider or per model.
- `.claude/evals/*.json` carry the fixtures. Each declares a `kind` plus a `probes` array. Supported kinds: `discipline`, `language`, `pairing`, `general-profile`.
- `.github/workflows/agent-eval.yml` wires the harness into GitHub Actions on `workflow_dispatch` only.

### Fixture kinds

- **`discipline`** (`agent-discipline.json`): chitchat versus tool-warranted. Measures chitchat false-positives and tool-warranted correct rate.
- **`language`** (`agent-language.json`): English versus Swedish. Text-based detection via Swedish marker-word set (min 2 hits).
- **`pairing`** (`agent-spatial-pairing.json`): data tool plus paired spatial tool. Verdict per probe: full, partial, missing, unexpected-tool. Includes `fallbackSpatialTools` for accepted substitutions.
- **`general-profile`** (`agent-general-profile.json`): cross-profession deploy posture. Carries an inline `profiles` map keyed by `profileKey` (ai-engineer, nurse, marketer, chef). Harness sends `x-jobtriage-mode: deploy` via `forceDeploy: true`.

### Request shape

The harness posts to `PROBE_CHAT_URL` (default `http://localhost:3000/api/chat`) with `x-jobtriage-provider`, optional `x-jobtriage-mode: deploy`, and optional `Authorization: Bearer <key>`. Body shape:

```json
{
  "messages": [
    {
      "id": "u1",
      "role": "user",
      "parts": [{ "type": "text", "text": "<prompt>" }]
    }
  ],
  "profile": "<string or null>"
}
```

Response is the AI SDK SSE stream. The harness regex-parses tool calls with `/"toolName":"([a-zA-Z]+)"/g` and text deltas with `/"delta":"(...)"/g`.

### `workflow_dispatch` posture and secrets

- `agent-eval.yml` triggers on `workflow_dispatch` only. No cron. The maintainer-funded providers stay capped.
- Inputs: `providers` (comma-separated, default `gemini` for the free tier), `fixture` (default `.claude/evals/agent-discipline.json`).
- Per-provider gating reads `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`. Providers without a configured secret emit a warning and skip.
- Each run starts a local web server (`bun build && bun start`), polls health, then drives the harness twice: the dispatch-supplied fixture, then `agent-general-profile.json` hardcoded.
- Output lands at `.claude/.tmp/ollama-model-research/smoke-{provider}-{fixture-name}.md` and uploads as a build artifact.

### Deploy posture override

General-profile runs flip `forceDeploy: true`, which sends `x-jobtriage-mode: deploy`. The chat route honors it only when `!process.env.VERCEL`. Local Ollama dev surface can simulate deploy behavior (corpus-excluded tool set) for portability checks. Vercel CI sets `VERCEL` automatically so prod cannot be forced from outside.

### Model bake-off history (gemma4:26b selection)

`gemma4:26b` was chosen over the prior `qwen3-coder:30b` after a six-model A/B smoke run via this harness. The coder variant fired retrieval tools on conversational turns (3/5 false-positives on "hi", "what can you do", "how are you"), a known limitation of agentic-coder RL training. Gemma 4 26B (MoE 25.2B / 3.8B-active) hit 0/5 chitchat false-positives plus 3/3 tool-warranted correct at 2.6 s avg latency, beat the dense `gemma4:31b` on speed at the same accuracy, and beat `mistral-small3.2:24b` and `qwen3:32b` on tool selection. The two latter models mis-fired `searchJobs` without a JobTech concept_id, a system-prompt rule violation. `qwen3:30b` was disqualified for leaking thinking-channel content into chat output. Re-run the harness on future model swaps.

## Gotchas

- For Ollama, the harness calls `bun run restart:web` between model batches with `OLLAMA_MODEL_ID` set in env. Restart timeout defaults to 120s. A timed-out restart fails that model and continues to the next.
- BYOK runs skip the restart and require `PROBE_API_KEY` set per provider.
- The `kind` field is required. The harness dispatches by `kind` and an unknown value fails fast. Add a new probe shape by extending the dispatch table, not by reusing an existing `kind`.
