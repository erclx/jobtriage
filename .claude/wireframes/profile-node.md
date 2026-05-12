---
title: Profile node
description: Anchored to the top-left of every canvas view, never deleted
type: wireframe
---

# Profile node

Anchored to the top-left of every canvas view, never deleted. The profile node is always present even when no profile is saved.

## Empty

```plaintext
+--------------------------+
| [user] PROFILE           |
|                          |
| No profile yet           |
| Click to add criteria    |
+--------------------------+
```

## Saved

```plaintext
+--------------------------+
| [user] PROFILE        [✎]|
|                          |
| Senior AI engineer       |
| 412 chars · click to     |
| edit                     |
+--------------------------+
```

## Behavior

- Single click or double click opens the profile dialog. Both work.
- The headline summary pulls the first non-heading line from the saved markdown and truncates at 64 characters.
- When `connectProfileToAds` fires, edges spawn from the right handle of this node to matched ads on the canvas. Each edge takes the matching tone (emerald, amber, muted) and scales width plus opacity by score. The percentage number lives inside the ad card's match rationale row, not on the edge itself, so the line stays a clean visual thread.
