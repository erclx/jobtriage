---
title: Diagrams
---

# Diagrams

Source: planning docs (`ARCHITECTURE.md`, `REQUIREMENTS.md`, `docs/python.md`, `docs/web.md`). Five diagrams cover system components, agent request flow, hybrid retrieval pipeline, corpus ingestion pipeline, and deployment topology.

## System components

The five-layer stack from chat UI down to SQLite storage, plus the CLI path that bypasses the HTTP layer and talks directly to Python tools.

```mermaid
flowchart TD
    subgraph Browser["Browser"]
        UI["Chat UI<br/>Next.js and AI Elements"]
        AG["Agent shell<br/>Vercel AI SDK"]
        TW["Tool wrappers<br/>TypeScript"]
        SS["sessionStorage<br/>API key and profile"]
    end

    subgraph FlyIO["Fly.io"]
        FA["FastAPI"]
        JC["JobTech client"]
        HR["Hybrid retriever"]
        CM["Criteria matcher"]
        FTS["FTS5 keyword index"]
        VEC["Embedding column<br/>sqlite-vec"]
    end

    subgraph LocalMachine["Local machine"]
        CLI["Typer CLI"]
        LOG["triage log"]
    end

    JT["JobTech API<br/>Platsbanken"]
    LLM["LLM<br/>Anthropic or Ollama"]

    UI --> AG
    SS -.->|per request| AG
    AG -->|tool calls| TW
    AG -->|LLM stream| LLM
    TW -->|HTTP POST| FA
    FA --> JC
    FA --> HR
    FA --> CM
    HR --> FTS
    HR --> VEC
    JC --> JT
    CLI --> JC
    CLI --> HR
    CLI --> CM
    CLI --> LOG
```

## Agent request flow

One full turn: the user sends a question, the Next.js API route runs the agent loop, calls two tools via FastAPI, and streams a ranked answer with tool-call traces back to the browser.

```mermaid
sequenceDiagram
    actor User
    participant Chat as "Chat UI"
    participant Route as "api/chat/route.ts"
    participant API as "FastAPI"
    participant LLM as "Anthropic"

    User->>Chat: free-form question and profile
    Chat->>Route: POST /api/chat with BYOK key
    Route->>LLM: messages and tool definitions
    LLM-->>Route: tool call - searchJobs
    Route->>API: POST /v1/jobs/search
    note right of API: calls JobTech API<br/>returns ad list
    API-->>Route: ranked results
    Route->>LLM: tool result
    LLM-->>Route: tool call - semanticSearch
    Route->>API: POST /v1/jobs/semantic
    note right of API: BM25 and cosine over SQLite<br/>reciprocal rank fusion
    API-->>Route: ranked results
    Route->>LLM: all tool results
    LLM-->>Route: final answer text
    Route-->>Chat: streamed response and tool traces
    Chat-->>User: ranked ads with rationale
```

## Hybrid retrieval pipeline

Query-time path through `semanticSearch` and `triageBatch`. Two parallel retrievers merge via reciprocal rank fusion before optional profile scoring.

```mermaid
flowchart LR
    Q["User query"]
    FTS["FTS5 keyword index"]
    VEC["Embedding column<br/>multilingual-e5-base"]

    BM["BM25 search"]
    DS["Dense cosine scan"]
    RRF["Reciprocal rank fusion"]
    CM["Criteria matcher<br/>profile scoring"]
    OUT["Ranked ads<br/>with rationale"]

    Q --> BM
    Q --> DS
    FTS -->|read| BM
    VEC -->|read| DS
    BM --> RRF
    DS --> RRF
    RRF --> CM
    CM --> OUT
```

## Corpus ingestion pipeline

How the SQLite ad corpus is built and kept current. The `sweep` CLI command pulls live ads from JobTech and writes chunks to SQLite. A separate `index` command backfills the embedding column for hybrid retrieval.

```mermaid
flowchart LR
    JT["JobTech API<br/>Platsbanken"]

    subgraph CLI["Typer CLI"]
        SW["sweep command<br/>pull and ingest ads"]
        IX["index command<br/>backfill embeddings"]
    end

    subgraph Storage["SQLite"]
        CH["ad chunks<br/>text and metadata"]
        FTS["FTS5 virtual table<br/>BM25 keyword index"]
        VEC["embedding column<br/>BLOB per chunk"]
    end

    EMB["Embedder<br/>multilingual-e5-base"]

    JT -->|ad list| SW
    SW -->|chunked rows| CH
    SW -->|mirrored rows| FTS
    IX -->|reads unindexed chunks| CH
    IX --> EMB
    EMB -->|vectors| VEC
```

## Deployment topology

Web surface on Vercel, backend on Fly.io with SQLite embedded in the container image. The Next.js API route runs the agent loop server-side and forwards tool calls to FastAPI. The BYOK Anthropic key is sent per request and never persisted server-side.

```mermaid
flowchart TD
    subgraph Vercel["Vercel"]
        NX["Next.js<br/>static assets and SSR"]
        RT["api/chat/route.ts<br/>AI SDK agent loop"]
    end

    subgraph Client["Browser"]
        UI["Chat UI<br/>useChat hook"]
    end

    subgraph FlyIO["Fly.io"]
        FA["FastAPI container"]
        DB["SQLite<br/>embedded in image"]
    end

    JT["JobTech API<br/>public, free"]
    ANT["Anthropic API<br/>user BYOK key"]
    OLL["Ollama<br/>dev only"]

    NX -->|serves| Client
    Client -->|POST /api/chat| RT
    RT -->|tool HTTP calls| FA
    RT -->|LLM stream| ANT
    RT -.->|dev stream| OLL
    FA -->|reads| DB
    FA -->|ad queries| JT
```
