---
title: Input row
description: Always at the bottom of the chat rail
type: wireframe
---

# Input row

Always at the bottom of the chat rail. Pinned, not floating.

```plaintext
+------------------------------------------------------------+
| Ask about Swedish job ads...                            [↵]|
+------------------------------------------------------------+
```

## Behavior

- Submit on Enter. Shift-Enter inserts a newline.
- The submit button shows the stop icon while a response is streaming. Clicking it cancels the stream.
- The input clears on submit. No undo. The user can resubmit by retyping.
