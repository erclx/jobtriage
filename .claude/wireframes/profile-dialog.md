---
title: Profile dialog
description: Opens from the header profile button
type: wireframe
---

# Profile dialog

Opens from the header profile button. Replaces the prior collapsed drawer that sat above the chat surface.

```plaintext
+--------------------------------------------------------+
| Profile                                            [x] |
| Paste markdown describing your role, location,         |
| must-haves, or deal-breakers. Forwarded with every     |
| chat turn. Held only in this browser tab and never     |
| persisted on the server. Closing the dialog saves any  |
| pending edits.                                         |
|                                       [ Load example ] |
| +----------------------------------------------------+ |
| | ## Role                                            | |
| | Senior AI engineer                                 | |
| | ## Must-haves                                      | |
| | Stockholm, agentic systems, RAG, hybrid retrieval  | |
| +----------------------------------------------------+ |
| 412 / 20,000 chars             Unsaved changes (amber) |
|                              [✓ Saved]  [Clear]  [Save]|
+--------------------------------------------------------+
```

## Behavior

- `Load example` is only shown when the draft is empty. It fills the textarea with a short example profile and marks the draft dirty.
- `Save` is enabled whenever the draft differs from the saved value, regardless of length. The 20,000-char limit is a soft cap, not a hard reject. The `Unsaved changes, will save on close` label next to the buttons carries the dirty signal and tells the user the close interceptor will commit.
- The character counter turns amber and appends `(over soft cap)` when the draft exceeds the limit. The dialog still saves the draft.
- `Clear` empties both draft and saved value. No confirmation. Cheap to redo by pasting again. Disabled when both stored and draft are empty.
- After `Save`, a transient `✓ Saved` confirmation replaces the dirty label for 2.5 seconds (`role="status"`) before the buttons return to their idle state. Closing the dialog mid-confirmation does not interrupt the timer.
- The textarea grows to fill available height. Long pastes scroll inside the box, not the page.
- Dialog dismisses with Escape, the close button, or clicking outside. The wrapper intercepts the close transition and persists the draft to sessionStorage whenever it differs from the saved value, including over-cap drafts. No silent-loss path.
