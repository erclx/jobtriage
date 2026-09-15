---
title: Evaluation
description: Retrieval ablation, agent eval, and the multilingual embedding comparison, with the commands that reproduce each
---

# Evaluation

Three measured comparisons back the retrieval and agent claims in the README: a retrieval ablation, a per-provider agent eval, and a multilingual embedding comparison. Each table below is reproducible from a checked-in fixture.

## Hybrid retrieval ablation

`uv run jobtriage evaluate`

Hybrid retrieval (BM25 plus dense embeddings fused via reciprocal rank fusion over a local SQLite corpus) powers the Typer CLI and the local Next.js dev surface. The deployed demo at the live URL does not run this path: it calls the JobTech taxonomy and JobSearch APIs directly so it can answer for any profession a visitor pastes, instead of being pinned to a maintainer-curated corpus. The numbers below describe the repo and CLI story, reproducible end-to-end against the checked-in golden set.

50-query Swedish golden set against a 59-ad corpus from Spotify, Klarna, Volvo Group, Volvo Cars, Ericsson, HT Engineering, Stig Ericsson Bil, Montico, and Isaksson Rekrytering. Embeddings from `intfloat/multilingual-e5-base`.

| Configuration | precision@1 | precision@5 | precision@10 | recall@10 | p50 ms | p95 ms |
| ------------- | ----------- | ----------- | ------------ | --------- | ------ | ------ |
| filter-only   | 0.020       | 0.020       | 0.020        | 0.150     | 0.0    | 0.0    |
| bm25-only     | 0.680       | 0.224       | 0.124        | 0.920     | 0.2    | 1.2    |
| dense-only    | 0.780       | 0.240       | 0.132        | 0.965     | 6.4    | 7.8    |
| hybrid        | 0.720       | 0.240       | 0.128        | 0.950     | 6.2    | 15.2   |

Dense alone wins precision@1 on this corpus by 6 points over hybrid, and the multilingual table below shows the gap widens at the larger encoder. Hybrid still earns its place on recall and on adversarial queries where exact keyword matches (model names, employer-specific jargon) dominate. The score floor at `JOBTRIAGE_RRF_FLOOR=0.025` suppresses low-relevance noise at the API boundary.

## Agent eval

`PROBE_FIXTURE=web/evals/agent-conversation.json bun web/scripts/model-probe.ts`

The agent loop is measured side by side per provider through `web/scripts/model-probe.ts`, which drives `/api/chat` against fixtures in `web/evals/*.json`. The `conversation` fixture (`agent-conversation.json`) runs ten probes in deploy posture across six axes: multi-tool chains, concept-id discipline, profile-aware reasoning, adversarial queries, tool-error recovery, and citation discipline. Each probe asserts tool-call accuracy, keyword recall, and where applicable concept-id discipline and recovery detection. Static snapshot, refreshed on significant prompt or tool changes.

| Provider  | Model               | Passed | Tool-call accuracy | Keyword recall | Avg latency |
| --------- | ------------------- | ------ | ------------------ | -------------- | ----------- |
| anthropic | `claude-sonnet-4-5` | 5/10   | 92%                | 56%            | 31996 ms    |
| openai    | `gpt-4o-mini`       | -      | -                  | -              | -           |
| gemini    | `gemini-2.5-flash`  | -      | -                  | -              | -           |

BYOK rows populate via `workflow_dispatch` on the `Agent Eval` workflow with the maintainer key, kept off the nightly schedule to cap spend. Ad-id recall is reported only on probes scoped to the frozen local CLI corpus, since the live JobTech ad set rotates daily and deploy-mode probes use keyword recall against snippets instead.

Local Ollama covers the local-corpus tools in `agent-discipline.json` and `agent-spatial-pairing.json`. Conversation fixture probes all force deploy mode so BYOK and Ollama see the same tool set when both run it.

OpenAI and Gemini rows backfill in v6.1. Gemini's free tier rate-limits when the workflow runs three fixtures back to back, so the harness needs a per-probe pacing knob before its row reads honestly. OpenAI needs a maintainer key configured as a repo secret.

## Multilingual embedding comparison

`uv run jobtriage evaluate-embeddings`

Same 50-query golden set, swapping the encoder while holding the corpus, BM25 index, and harness constant. The English-only baseline (`all-MiniLM-L6-v2`) measures what the project would look like without multilingual support.

| Model                                  | Dim  | Configuration | precision@1 | precision@5 | precision@10 | recall@10 | p50 ms | p95 ms |
| -------------------------------------- | ---- | ------------- | ----------- | ----------- | ------------ | --------- | ------ | ------ |
| intfloat/multilingual-e5-base          | 768  | dense         | 0.780       | 0.240       | 0.132        | 0.965     | 4.4    | 6.0    |
| intfloat/multilingual-e5-base          | 768  | hybrid        | 0.740       | 0.240       | 0.128        | 0.950     | 4.8    | 6.0    |
| intfloat/multilingual-e5-large         | 1024 | dense         | 0.860       | 0.236       | 0.130        | 0.945     | 7.6    | 9.8    |
| intfloat/multilingual-e5-large         | 1024 | hybrid        | 0.820       | 0.236       | 0.126        | 0.940     | 8.2    | 9.6    |
| sentence-transformers/all-MiniLM-L6-v2 | 384  | dense         | 0.700       | 0.232       | 0.120        | 0.855     | 3.1    | 4.2    |
| sentence-transformers/all-MiniLM-L6-v2 | 384  | hybrid        | 0.760       | 0.236       | 0.128        | 0.925     | 3.3    | 3.9    |

The English-only baseline loses 11 points of recall@10 against `e5-base` on the Swedish golden set, and BM25 fusion recovers 7 of those points back. `e5-large` lifts precision@1 by 8 points over `e5-base` for about 70% more memory and dense latency. The e5 prefix tokens MiniLM never trained on read as noise and suppress its dense numbers slightly.

## Reproducing a run

Every command above needs the Python environment: `cd python && uv sync`. The agent eval additionally needs the web server built (`cd web && bun run build`) and a provider key exported as `PROBE_API_KEY` for any row beyond the mock defaults.

## Back to the project

[README](../README.md) has the headline numbers and what the project is for. For the retrieval design behind these numbers (chunking, the embedding prefix contract, the RRF floor), see `canon/context/retrieval.md` in the source tree.
