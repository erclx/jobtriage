---
title: Chat rail conversation
description: Shown in the left rail after at least one assistant turn has rendered
type: wireframe
---

# Chat rail conversation

Shown in the left rail after at least one assistant turn has rendered.

```plaintext
+----------------------------------+
|                  [user bubble]   |
|                                  |
| > Triaged batch  [Completed]   v |
|                                  |
| Three roles look strong, two are |
| stretches. See the canvas.       |
|                                  |
| [Ask about Swedish job ads...] ↵ |
+----------------------------------+
```

## Behavior

- The chat rail no longer renders ad cards inline. Cards live on the canvas to the right. The rail keeps user bubbles, assistant text, and the data-tool trace tree (collapsed).
- Spatial tool parts (`placeAds`, `groupAds`, `connectProfileToAds`, `pairAdsForCompare`, `placeAdsOnTimeline`, `pinToShortlist`, `markStatus`, `setView`) render as a single muted summary line per call (`Placed 5 ads on the canvas`, `Grouped 4 ads into 3 clusters`, `Connected profile to 4 ads`, etc.). The trace tree is reserved for data-tool inputs and outputs.
- The summary line keeps the chat path identical on desktop and mobile, so a user without the canvas still sees evidence of the agent's work.
- Assistant text below the trace is a one-line summary or recommendation. The canvas carries the cards. The text carries the judgment.
- Each data tool name maps to a friendly label: `Searched JobTech filter`, `Hybrid retrieval`, `Matched profile to ad`, `Triaged batch`, `Compared roles`, `Deadline watch`, `Engagement status`.
