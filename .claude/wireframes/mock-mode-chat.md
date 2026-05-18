---
title: Mock mode chat
description: Shown when the visitor picks Try the demo, no key from the BYOK gate
type: wireframe
---

# Mock mode chat

Shown when the visitor picks `Try the demo, no key` from the BYOK gate. Replays scripted SSE transcripts against the live JobTech surface so a first-time visitor can see the agent work without supplying a provider key.

## Empty state

```plaintext
+----------------------------------+
|                                  |
|        [sparkle]                 |
|        Demo mode                 |
|        Pick a scripted query     |
|        to replay against live    |
|        JobTech ads.              |
|                                  |
|   [ Stockholm AI roles ... ]     |
|   [ Active ads with Azure ML ]   |
|   [ Roles outside Stockholm ]    |
|   [ Hugging Face or Triton  ]    |
|                                  |
|----------------------------------|
| Paste a key to ask your own  ⎵ q |  ← read-only textarea
| Switch to BYOK              [✈]  |  ← submit posts switch, not chat
+----------------------------------+
```

## Mid-conversation strip

```plaintext
+----------------------------------+
|                  [user bubble]   |
|                                  |
| > Triaged batch  [Completed]   v |
|                                  |
| Three roles look strong.         |
|                                  |
| TRY ANOTHER DEMO                 |
| [ Stockholm AI roles ... ]       |
| [ Active ads with Azure ML ]     |
| [ Roles outside Stockholm ]      |
|----------------------------------|
| Paste a key to ask your own  ⎵ q |
| Switch to BYOK              [✈]  |
+----------------------------------+
```

## Terminal CTA (all four chips fired)

```plaintext
+----------------------------------+
|                  [last user]     |
|                                  |
| ...                              |
|                                  |
| +------------------------------+ |
| | That is the full demo.       | |
| | Switch to BYOK to ask your   | |
| | own questions, or start over | |
| | to replay any chip.          | |
| |                              | |
| | [ Switch to BYOK ] [Start over] |
| +------------------------------+ |
|----------------------------------|
| Paste a key to ask your own  ⎵ q |
| Switch to BYOK              [✈]  |
+----------------------------------+
```

## Behavior

- Chip stack only renders the prompts the visitor has not yet tried. Tried-prompt state persists to sessionStorage under `jobtriage:tried-prompts`, so reloading the tab keeps used chips hidden alongside the restored chat history.
- Clicking a chip submits the prompt and auto-populates the saved profile with the chip's bundled profile markdown. The profile node updates on the canvas as part of the same turn.
- When the saved profile came from a previous mock chip in the same session, the chip swaps profiles silently and runs. The session tracks profile provenance under `jobtriage:profile-source` (`'mock' | 'user'`).
- When the saved profile came from a BYOK paste (`profile-source = 'user'`), the chip stages a confirm Dialog with `Keep my profile` and `Replace with demo profile` before firing. `Keep` runs the chip against the existing profile. `Replace` swaps in the demo profile and runs.
- The textarea is read-only with `aria-disabled="true"`, `tabIndex="-1"`, and a fixed placeholder telling the visitor to paste a key. Submit cancels into the switch-provider flow.
- The voice-input mic is hidden in mock mode. Its slot is replaced by the inline `Switch to BYOK` link.
- The send button is permanently disabled. Pressing Enter on the textarea posts a switch-provider request, never a chat turn.
- Terminal CTA replaces the chip strip after all four prompts fire. `Start over` clears tried-prompt state without touching the conversation or canvas, so the chips return for another pass.
- Leaving mock mode (via the inline link, the terminal CTA, or the header `Switch provider` button) clears the chat, canvas, AND the saved profile, since mock chips auto-populated it.
