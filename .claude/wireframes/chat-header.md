---
title: Chat header
description: Spans the top of the workspace
type: wireframe
---

# Chat header

Spans the top of the workspace. Does not appear on the BYOK gate.

```plaintext
+----------------------------------------------------------------------+
| jobtriage              [user] Profile · 412  [✨ New]  [moon] [Out]  |
| Live agent triages Swedish job ads against any profile.              |
+----------------------------------------------------------------------+
```

## Behavior

- The profile button shows `Add profile` when no profile is saved and `Profile · N chars` when the session has one. Clicking opens the profile dialog.
- `New chat` opens a confirm dialog before clearing the conversation, the canvas state, and the pinned shortlist. Profile, provider, and key stay. The button is disabled while a response is streaming and when chat plus canvas plus shortlist are already empty.
- The confirm dialog softens when stakes are low (at most one user turn AND no canvas content): copy reads `The current prompt clears` and the confirm button takes the default variant. Above that threshold, copy reads `The conversation, canvas, and pinned shortlist all clear` and the confirm button takes the destructive variant.
- `Switch provider` opens a confirm dialog. Cancel keeps the current session. Confirm clears the stored key, provider, chat, and canvas, then returns the user to the BYOK gate. The saved profile stays. Anonymous, single-session.
- The theme button cycles system, light, dark, system. The icon reflects the current mode (monitor for system, sun for light, moon for dark). The aria-label names the current mode and the next state, so clicking back to system restores the OS color-scheme listener.
- Below `sm`, the profile, new chat, and switch provider buttons collapse to icon-only. A radix `Tooltip` surfaces the action name on hover or keyboard focus. The aria-label still serves screen readers across both states.
- Subtitle stays visible at all viewport widths. The header does not shrink to a logo bar.
