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

## The fixed data-to-spatial tool pairing

```mermaid
flowchart TB
    accTitle: Every data tool fires exactly one spatial tool after it
    accDescr: The system prompt fixes the pairing between the seven data tools and the eight spatial tools. searchJobs and semanticSearch both pair with placeAds. The other five data tools each pair with one distinct spatial tool. pinToShortlist and setView are user-driven and pair with no data tool.

    agent[Agent picks a data tool]
    data["7 data tools<br/>searchJobs, semanticSearch, triageBatch,<br/>matchProfile, compareRoles, deadlineWatch, trackStatus"]
    spatial["Its paired spatial tool<br/>placeAds, groupAds, connectProfileToAds,<br/>pairAdsForCompare, placeAdsOnTimeline, markStatus"]
    user["pinToShortlist, setView<br/>user-driven, no data tool"]

    agent --> data --> spatial
    agent -.-> user
```

The system prompt fixes one spatial tool per data tool call. `searchJobs` and `semanticSearch` both pair with `placeAds`, since both return a ranked ad list for the canvas to lay out.

The other five data tools each pair with a distinct spatial tool matching what they compute: `groupAds` for a batch triage, `connectProfileToAds` for a profile match, `pairAdsForCompare` for a comparison, `placeAdsOnTimeline` for a deadline query, `markStatus` for an engagement update. `pinToShortlist` and `setView` never follow a data tool. A user action drives both directly.

The exact pairing table, plus how profile-fit composition stacks `connectProfileToAds` on top of the default pairing, lives in `.claude/context/agent.md`.
