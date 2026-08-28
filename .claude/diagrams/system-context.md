---
title: System context
description: Who uses jobtriage, what it talks to, and where its boundary sits, drawn from REQUIREMENTS.md
category: System context
verified: 'TODO: never verified'
---

# System context

```mermaid
flowchart TB
    accTitle: Who uses jobtriage and what it talks to
    accDescr: A visitor drives a web chat and canvas, which calls an agent loop backed by Anthropic, OpenAI, Gemini, or local Ollama. The agent calls Python tools, which read a local SQLite corpus or hit Sweden's JobTech API live.

    user[Visitor]
    web[Web chat + canvas]
    agent["Agent loop<br/>Anthropic, OpenAI, Gemini, or local Ollama"]
    backend[Python tools]
    corpus[(Local SQLite corpus)]
    jobtech[JobTech API]

    user --> web
    web --> agent
    agent --> backend
    backend --> corpus
    backend --> jobtech
```

A visitor drives a chat UI backed by an LLM agent. The agent calls Python tools over HTTP, which either read a local SQLite corpus or hit Sweden's JobTech API live. The right half of the chat surface is a canvas the agent populates with structured ad cards.

The deployed demo runs in a slim posture that skips the corpus and goes straight to JobTech live, since a maintainer-curated corpus pre-swept against one profession returns nothing for a visitor in another. The local CLI and the local browser dev surface keep the corpus in the loop. See `.claude/context/agent.md` for the provider switch and deploy-vs-local posture.
