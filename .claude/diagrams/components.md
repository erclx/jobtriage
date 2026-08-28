---
title: Components
description: The layered structure inside the boundary, drawn from ARCHITECTURE.md
category: Components
verified: 'TODO: never verified'
---

# Components

```mermaid
flowchart TB
    accTitle: The offline ingestion layer and the online query layer sharing one corpus
    accDescr: An offline CLI sweep populates a SQLite corpus nightly. Online query traffic reads that same corpus, or hits the JobTech live API directly, and never writes to it.

    subgraph offline["Offline · CLI · once a night"]
        sweep[sweep] --> ingest["ingest + index embeddings"]
        ingest --> sqlite1[(SQLite corpus)]
    end

    subgraph online["Online · per user query"]
        query[User query] --> agent["Agent + tools"]
        agent --> sqlite2[(SQLite corpus)]
        agent --> live[JobTech live API]
    end

    sqlite1 -.same file.-> sqlite2
```

Ingestion is the only path that writes to the corpus. It runs nightly, CLI-only. Online query traffic is read-only, and the same SQLite file backs both phases on local.

Data tools query JobTech or the corpus directly. Spatial tools never call the backend at all. They echo their input instead, and the client translates that echo into canvas mutations. See `.claude/context/canvas.md` for the spatial-tool bridge.

The deployed Cloud Run image is slim and omits the corpus, since v4.10 gated corpus-dependent tools out of the deploy posture. In that posture the online layer above loses its corpus edge entirely and leans on the live JobTech branch alone.
