---
title: Voice input
description: Mic affordance in the chat input row, Chrome-only
type: wireframe
---

# Voice input

Mic affordance in the chat input row, available only when the browser exposes a SpeechRecognition constructor (Chrome and Chromium-derived browsers). The button is omitted entirely on unsupported browsers and in mock mode.

## Idle

```plaintext
+----------------------------------+
| Ask about Swedish job ads...     |
|                                  |
| [mic]                       [✈]  |
+----------------------------------+
        ↑ tooltip: Voice input · Chrome only
```

## Listening

```plaintext
+----------------------------------+
| Senior AI engineer roles in      |
| Stockholm, only active...        |  ← partial transcript streams in
|                                  |
| [mic-off]•                  [✈]  |  ← solid variant, aria-pressed=true
+----------------------------------+   ↑ destructive-tone pulse dot, top-right
            ↑ tooltip: Stop voice input
```

## Permission denied

```plaintext
+----------------------------------+
| Allow microphone access in the   |  ← role="status", muted destructive
| browser to use voice input.      |
|                                  |
| Ask about Swedish job ads...     |
|                                  |
| [mic]                       [✈]  |
+----------------------------------+
```

## No speech detected

```plaintext
+----------------------------------+
| No speech detected. Try again    |  ← role="status", muted destructive
| or type instead.                 |
|                                  |
| Ask about Swedish job ads...     |
|                                  |
| [mic]                       [✈]  |
+----------------------------------+
```

## Behavior

- Mic toggles a session-scoped SpeechRecognition instance with `continuous: true` and `interimResults: true`. Browser language drives `recognition.lang`, falling back to `en-US`.
- While listening, the input value is the user's pre-voice baseline plus the final-plus-interim transcript. The baseline is captured at start so manual edits before activating the mic survive.
- Typing into the textarea while the mic is listening aborts recognition immediately. The mic flips inactive and the typed text stays in the input. The user can re-click the mic to dictate from the new baseline. This avoids the speech engine's cumulative `final` from overwriting manual keystrokes between chunks.
- Stopping the mic, submitting the form, or unmounting the component all abort the recognition instance. The interim transcript carries forward as part of the input value.
- Permission-denied or service-not-allowed errors render the inline status row above the input until the user dismisses it by typing or toggling the mic again. The button stays available so the user can retry after granting permission.
- A small destructive-tone dot with a ping animation overlays the mic button at the top-right while listening. Stop hides it.
- The button is suppressed on browsers that lack the constructor. Server-render reports `unsupported`. Hydration re-checks once `window` is available.
