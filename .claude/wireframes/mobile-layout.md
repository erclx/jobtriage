---
title: Mobile layout
description: Below-lg fallback for every surface
type: wireframe
---

# Mobile layout

Below the `lg` breakpoint (1024px) the spatial canvas is the wrong product. The chat rail expands to fill the viewport and a static notice tells the visitor the canvas is hidden. No effort has gone into a real responsive design beyond the fallback.

## BYOK gate (sm and md)

```plaintext
+---------------------+
|                     |
| [ Try the demo  ]   |  ← stacks vertically, full-width buttons
| -- or bring own --  |
|                     |
| +-----------------+ |
| | BYOK form       | |
| | provider radio  | |
| | wraps to 3 rows | |  ← fieldset stacks under 360px
| | key input       | |
| | Start chat      | |
| +-----------------+ |
|                     |
| -- or --            |
| [ Use Ollama   ]    |
+---------------------+
```

## Workspace (sm and md)

```plaintext
+---------------------+
| jobtriage      ...  |
+---------------------+
| Best viewed on a    |
| desktop. The        |
| spatial canvas      |
| needs at least      |
| 1024px.             |
+---------------------+
| [chat conversation] |  ← chat rail fills the viewport
|                     |
| [Ask about ads...]  |
+---------------------+
```

## Behavior

- Below `lg`, the splitter and canvas column hide. The chat rail expands to 100% width and the prompt input stays pinned to the bottom.
- The view switcher chips, profile node, and canvas zoom controls do not render below `lg`. The agent's spatial tool calls still execute but produce no visible canvas. The chat rail trace still shows the single-line summaries so the run remains legible.
- The fallback notice renders as a card at the top of the chat rail, above the conversation. Static copy. No dismiss control.
- BYOK gate stacks vertically at all viewport widths below `lg`. The provider radio wraps to a single column under 360px so the touch targets stay tappable.
- Mobile is not a supported design target. The fallback exists to keep the page from rendering broken on a phone tap-through, not to enable real triage on mobile.
