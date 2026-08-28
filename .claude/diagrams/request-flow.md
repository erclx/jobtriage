---
title: Request flow
description: How one chat turn travels from the browser through the agent loop and back
category: Request flow
verified: 'TODO: never verified'
---

# Request flow

```mermaid
sequenceDiagram
    accTitle: One chat turn through the agent loop
    accDescr: The browser posts a turn to the chat route, which resolves a provider from headers, runs the AI SDK step loop, dispatches data tools to the FastAPI backend and spatial tools as an in-process echo, then streams the result back to the trace tree and the canvas.

    participant Browser
    participant Route as "/api/chat"
    participant SDK as Vercel AI SDK
    participant Backend as FastAPI
    participant Canvas as CanvasBridge

    Browser->>Route: turn (messages + profile)
    Route->>Route: resolve provider from headers
    Route->>SDK: streamText, stopWhen stepCountIs 8
    loop each step
        SDK->>SDK: pick a tool or emit text
        alt data tool
            SDK->>Backend: POST tool call
            Backend-->>SDK: structured result
        else spatial tool
            SDK->>SDK: echo input, no backend call
        end
    end
    SDK-->>Route: SSE stream
    Route-->>Browser: SSE stream
    Browser->>Canvas: spatial tool-output parts
    Canvas->>Canvas: dispatch to reducer
```

The loop runs server-side in a Next.js route handler. The provider is picked per request from headers: BYOK visitors send `Authorization: Bearer <key>` for Anthropic, OpenAI, or Gemini, and local Ollama maps through a custom header. The Vercel AI SDK runs at most eight steps per turn.

Data tools post to the FastAPI backend and wait on a real result. Spatial tools never leave the server process. They echo their input, and the client's `CanvasBridge` translates the resulting output parts into canvas mutations.

Profile and BYOK key live in browser sessionStorage and never reach the server outside the request body. See `.claude/context/agent.md` for the full tool registry and `.claude/context/canvas.md` for the bridge.
