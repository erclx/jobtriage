---
title: Empty workspace
description: Shown after the gate is passed and before the first message
type: wireframe
---

# Empty workspace

Shown after the gate is passed and before the first message.

```plaintext
+----------------------------------+--------------------------------+
|                                  | [Triage][Timeline][Compare]... |
| [sparkle]                        |                                |
| Ask jobtriage                    |   +-------------+              |
| Spatial agent workspace over     |   | PROFILE     |              |
| Swedish Platsbanken ads.         |   | No profile  |              |
| Try one of these:                |   | yet         |              |
|                                  |   +-------------+              |
| ( Stockholm AI roles ... )       |                                |
| ( Active ads with Azure ML )     |   Ask a question on the left   |
| ( Roles outside Stockholm ... )  |   and the agent will populate  |
| ( Hugging Face or Triton )       |   this canvas with ad cards,   |
|                                  |   clusters, and timeline       |
| [Ask about Swedish job ads...] [↵]|  placements as it reasons.     |
+----------------------------------+--------------------------------+
```

## Behavior

- The empty state stacks the sparkle, headline, seed chips, and prompt input as one vertically-centered block inside the chat card. After the first message the prompt slides to the bottom and pins for the rest of the session.
- Seed chip rows wrap when they do not fit the column. Long chips truncate with an ellipsis. Hovering or focusing reveals the full text via the title attribute.
- Clicking a chip submits the chat turn directly. No intermediate edit step.
