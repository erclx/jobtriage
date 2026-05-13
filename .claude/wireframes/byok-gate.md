---
title: BYOK gate
description: First surface every visitor sees
type: wireframe
---

# BYOK gate

First surface every visitor sees. Only renders when no provider has been chosen this session.

```plaintext
+---------------------------------------------+
|                                             |
|    [ ✨  Try the demo, no key            ]  |
|                                             |
|    ----------- or bring your own ---------  |
|                                             |
|    +-----------------------------------+    |
|    |  [key icon]                       |    |
|    |                                   |    |
|    |  Bring your own API key           |    |
|    |  Held in this browser tab and     |    |
|    |  sent only to the jobtriage       |    |
|    |  server. Never written to disk.   |    |
|    |                                   |    |
|    |  Provider                         |    |
|    |  ( Anthropic )( OpenAI )( Gemini )|    |
|    |                                   |    |
|    |  Anthropic API key                |    |
|    |  [ sk-ant-...                  ]  |    |
|    |  Get a key at console.anthropic.  |    |
|    |  com.                             |    |
|    |                                   |    |
|    |  [          Start chat         ]  |    |
|    +-----------------------------------+    |
|                                             |
|    ----------------- or -----------------   |
|                                             |
|    [ [cpu icon]  Use local Ollama        ]  |
|    Requires Ollama with gemma4:26b on       |
|    localhost:11434.                         |
|                                             |
+---------------------------------------------+
```

## Behavior

- Three onramps, mutually exclusive: demo button (no key), BYOK form (one of three providers + key), Ollama button (single click).
- Provider radio uses three segmented buttons (Anthropic, OpenAI, Gemini). Switching providers updates the input label, placeholder, helper link, and prefix-blur hint. Does not clear the draft.
- Validate on blur: helper copy swaps to an amber warning when the draft does not start with the selected provider's expected prefix (`sk-ant-` for Anthropic, `sk-` for OpenAI, `AIza` for Gemini). The warning is informational, not blocking.
- `Start chat` requires a non-empty trimmed value. Empty submit shows an inline `Paste your <provider> API key.` error. Prefix-blur warning never blocks submit.
- Demo button writes `mock` to the provider slot, no key entry. Ollama button writes `ollama`, no key entry.
- Ollama is hidden on the deployed Vercel surface (production and preview) because the Vercel function cannot reach the visitor's `localhost:11434`. The dev surface at `localhost:3000` shows the full provider list. Visibility resolves at build time via `process.env.NEXT_PUBLIC_VERCEL_ENV` (Vercel auto-exposes for Next.js builds, unset locally), so the deployed bundle ships without the Ollama section header, button, and helper copy. The switch-overlay variant inherits the same gate.

## Switch-provider overlay variant

Shown when the chat header's `Switch provider` button fires while a provider is already chosen. The demo onramp is hidden if the current provider is already `mock`, so a visitor cannot loop demo-to-demo.

```plaintext
+---------------------------------------------+
|                                             |
|    [ ✨  Try the demo, no key            ]  | ← hidden when storedProvider == 'mock'
|    --------- or bring your own -----------  |
|                                             |
|    [BYOK form, prefilled provider radio  ]  |
|                                             |
|    -------------- or ----------------------  |
|    [ Use local Ollama                    ]  |
|                                             |
|    [ Cancel and keep current provider    ]  |
|                                             |
+---------------------------------------------+
```

- Submitting any onramp clears the chat, canvas, and stored key. The saved profile is also cleared if the previous provider was `mock` (mock auto-populates a profile per chip, so it leaks into a real session otherwise).
- `Cancel and keep current provider` dismisses the overlay without touching session state.
- Escape closes the overlay and returns focus to the trigger.

## Error variant

```plaintext
|  [ sk-ant-...                  ]  |
|  Paste your Anthropic API key.    |  ← role="alert", red
```

## Prefix-warning variant

```plaintext
|  [ AIza...                     ]  |
|  Most Anthropic keys start with   |
|  sk-ant-.                         |  ← role="status", amber
```
