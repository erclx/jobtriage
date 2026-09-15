---
title: Workspace layout
description: Two columns above 1024px wide
type: wireframe
---

# Workspace layout

Two columns above 1024px wide. Below 1024px the canvas hides and the chat rail fills the column.

```plaintext
+--------------------------+--------------------------------------+
| jobtriage   [Add profile]| Canvas view: Triage Timeline         |
| Live agent... [New] [☾] [Out] | Compare Shortlist     [Export]  |
+--------------------------+--------------------------------------+
| user: which active       |                                      |
| Stockholm AI roles       |   +------+ +------+ +------+        |
|                          |   | ad   | | ad   | | ad   |        |
| > Triaged batch (5)      |   +------+ +------+ +------+        |
|                          |                                      |
|                          |   [profile node]                     |
|                          |                                      |
|                          | [+] [-] [fit]                        |
| [Ask about ads...]       |                                      |
| [mic]               [↵]  |                                      |
+--------------------------+--------------------------------------+
```

- Left rail starts at 440px and is resizable between 320 and 640 via the splitter. Below `lg` the canvas and splitter hide and the rail fills the viewport.
- The splitter sits between the rail and the canvas. A small vertical pill in the middle of the column signals that it is draggable at rest and grows on hover or keyboard focus. Width persists in sessionStorage. `←` and `→` adjust by 8px (32px with Shift).
- Chat rail holds the conversation, the tool trace tree (collapsed by default), one-line spatial-tool summaries, the empty state with seed chips, and the prompt input pinned to the bottom.
- Canvas holds the view switcher chips at top, the React Flow surface in the middle, and the zoom controls at bottom-left. Below `lg` a static notice in the chat rail reads `Best viewed on a desktop. The spatial canvas needs at least 1024px.`.
