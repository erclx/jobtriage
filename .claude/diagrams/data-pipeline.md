---
title: Data pipeline
description: How the local corpus gets populated and how a query gets ranked against it
category: Data pipeline
verified: 'TODO: never verified'
---

# Data pipeline

```mermaid
flowchart TB
    accTitle: Corpus ingestion, then hybrid retrieval over that corpus
    accDescr: A CLI sweep pulls ads from JobTech, chunks descriptions, and indexes them. A separate index step backfills embeddings. A query is then scored two ways, dense cosine and BM25, fused with reciprocal rank fusion, and floored to suppress noise.

    sweep["CLI sweep"] --> chunks[(ad_chunks<br/>no embedding yet)]
    index["CLI index"] --> embed["Embed with<br/>multilingual-e5-base"]
    chunks --> embed
    embed --> blob[(embedding filled)]

    query[Free-form query] --> dense["Dense scan<br/>cosine over ad_chunks"]
    query --> bm25["FTS5 BM25 query"]
    blob --> dense
    dense --> rrf["Reciprocal rank fusion"]
    bm25 --> rrf
    rrf --> floor["Score floor<br/>JOBTRIAGE_RRF_FLOOR"]
    floor --> topk[Ranked top-k ads]
```

Two CLI commands run in order. `sweep` pulls from JobTech with structured filters and writes ads plus chunked description text. `index` backfills embeddings on chunks where the column is still null, so re-embedding never requires re-fetching. Ingestion is append-mostly: an ad no longer in the live result set gets marked inactive, never deleted, so yesterday's hits stay queryable.

When the agent picks `semanticSearch` or `triageBatch`, the backend embeds the query once and scores it two ways: cosine similarity over the dense embeddings and BM25 over the FTS5 keyword index. The two ranked lists are fused with reciprocal rank fusion, then a score floor (`JOBTRIAGE_RRF_FLOOR`, default 0.025) suppresses tangential matches on adversarial queries. `searchJobs` hits JobTech live and skips this pipeline entirely. See `.claude/context/retrieval.md` for the chunking contract and the RRF floor rationale.

## How the two eval harnesses measure the system

```mermaid
flowchart TB
    accTitle: Two independent eval harnesses, one per concern
    accDescr: model-probe.ts drives the live chat route with JSON fixtures and reports a per-axis pass table per provider. The Python harness runs a Swedish golden query set against the retriever alone and produces the retrieval ablation table.

    fixtures[".claude/evals/*.json"]
    probe["web/scripts/model-probe.ts"]
    route["/api/chat, provider per run"]
    models["Ollama, Anthropic,<br/>OpenAI, or Gemini"]
    table["Per-axis pass table"]

    fixtures --> probe -->|curl| route --> models --> probe --> table

    goldenset["Swedish golden query set"]
    pyharness["Python eval harness"]
    retriever["Hybrid retriever"]
    ablation["Precision-at-k plus latency"]

    goldenset --> pyharness --> retriever --> ablation
```

Two harnesses, one per concern. `model-probe.ts` drives the live `/api/chat` route with JSON fixtures and reports per-axis pass rates per provider, run on every PR that touches the prompt or the tools.

The Python harness runs the Swedish golden query set against the retriever alone, no LLM in the loop, and produces the four-configuration ablation table that ships in the README. Neither harness calls the other. Both are documented in `.claude/context/evals.md`.
