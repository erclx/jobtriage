---
title: Input row
description: Always at the bottom of the chat rail
type: wireframe
---

# Input row

Always at the bottom of the chat rail. Pinned, not floating.

```plaintext
+------------------------------------------------------------+
| Ask about Swedish job ads...                               |
|                                                            |
| [mic]                                                  [↵] |
+------------------------------------------------------------+
```

## Behavior

- Submit on Enter. Shift-Enter inserts a newline.
- The submit button shows the stop icon while a response is streaming. Clicking it cancels the stream.
- The input clears on submit. No undo. The user can resubmit by retyping.
- A microphone button sits in the tool row to the left of the submit button. Press-and-hold or click-to-toggle records via the Web Speech API and inserts the transcript at the cursor. See [voice-input.md](voice-input.md) for the recording states.
- In mock mode the placeholder swaps to `Paste a key to ask your own question.` and a `Switch to BYOK` text button replaces the mic on the left of the tool row. The submit button stays disabled until a key is pasted on the BYOK gate. See [mock-mode-chat.md](mock-mode-chat.md).
