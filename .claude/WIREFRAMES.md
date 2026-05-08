# Wireframes

ASCII wireframes for planning purposes. Structure and layout only, not final design. Update this doc when a new surface is designed or a layout decision changes.

What belongs:

- ASCII diagrams showing layout, hierarchy, and component placement
- A context sentence per section describing when and where it appears
- All meaningful states: empty, loading, error, and any variant where the layout changes significantly
- Exact UI copy strings: labels, empty states, confirmation text, hints
- Interaction rules: what triggers what, navigation flow, confirmation behavior
- Intentional omissions with a brief reason, so they are not re-added later

What does not belong:

- Implementation details (event listeners, API call counts, storage keys). Those live in ARCHITECTURE.md.
- Visual decisions (colors, spacing, typography). Those live in DESIGN.md.
- Pixel values or final measurements. Verify those in the browser.

Use `←` for inline annotations inside diagrams. Use sentence case for all text labels. Document state variants as separate subsections when the layout changes. Keep behavior bullets to UX only: what the user sees and does, not how the code handles it.

## BYOK gate

First surface every visitor sees. Only renders when no provider has been chosen this session.

```plaintext
+---------------------------------------------+
|                                             |
|    +-----------------------------------+    |
|    |  [key icon]                       |    |
|    |                                   |    |
|    |  Bring your own Anthropic key     |    |
|    |  jobtriage routes your chat       |    |
|    |  through Claude with the key you  |    |
|    |  supply. Held in this browser     |    |
|    |  tab's sessionStorage and sent    |    |
|    |  only to the jobtriage server     |    |
|    |  route. Never persisted on disk.  |    |
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
|    Routes the chat through a model          |
|    running on your machine. Requires Ollama |
|    serving qwen3-coder:30b on               |
|    localhost:11434.                         |
|                                             |
+---------------------------------------------+
```

### Behavior

- Anthropic side and Ollama side are mutually exclusive. Pick one to leave the gate.
- Validate format on blur: must start with `sk-ant-`. Helper copy below the input swaps to the validation message on error.
- `Start chat` enables once the input has a non-empty value. The blur error does not block submit on its own, only an empty value does.
- The Ollama branch is single-click. No key entry, no confirmation step.
- Helper copy under the Ollama button is required. A first-time visitor with no AI infra knowledge needs the prerequisite.

### Error variant

```plaintext
|  [ sk-ant-...                  ]  |
|  Anthropic keys start with sk-    |
|  ant-.                            |  ← role="alert", red
```

## Chat header

Spans the top of every chat surface. Does not appear on the BYOK gate.

```plaintext
+------------------------------------------------------------+
| jobtriage                                  [moon] [Switch  |
| Free-form chat over Swedish JobTech ads          provider] |
+------------------------------------------------------------+
```

### Behavior

- `Switch provider` clears the stored key and provider. Returns the user to the BYOK gate. Does not confirm. Anonymous, single-session.
- The moon icon toggles between light, dark, and system. Tooltip on hover names the next state.
- Subtitle stays visible at all viewport widths. The header does not shrink to a logo bar.

## Profile drawer

Sits above the chat surface inside the chat column. Always rendered, collapsed by default.

### Empty state

```plaintext
+------------------------------------------------------------+
| [user]  Profile  optional, sent with each request        v |
+------------------------------------------------------------+
```

### Open with empty draft

```plaintext
+------------------------------------------------------------+
| [user]  Profile  optional, sent with each request        ^ |
| Paste markdown describing your role, location, must-haves, |
| or deal-breakers. Forwarded with every chat turn. Held     |
| only in this browser tab and never persisted on the server.|
| +--------------------------------------------------------+ |
| | ## Role                                                | |
| | Senior AI engineer                                     | |
| | ## Must-haves                                          | |
| | ...                                                    | |
| +--------------------------------------------------------+ |
| 0 / 20,000 chars                       [Clear]   [ Save  ] |
+------------------------------------------------------------+
```

### Open with unsaved draft

```plaintext
+------------------------------------------------------------+
| [user]  Profile  280 chars saved, 412 unsaved (amber)    ^ |
| ...                                                        |
| +--------------------------------------------------------+ |
| | ## Role                                                | |
| | Senior AI engineer                                     | |
| | ## Must-haves                                          | |
| | Stockholm, agentic systems, RAG, hybrid retrieval      | |
| +--------------------------------------------------------+ |
| 412 / 20,000 chars   Unsaved changes (amber)  [Clear]  [ Save ] |
+------------------------------------------------------------+
```

### Behavior

- The header hint reflects state in three forms: `optional, sent with each request` when empty and unmodified, `N chars saved` when persisted and clean, `N chars saved, M unsaved` (amber) when persisted and dirty, and `M chars unsaved` (amber) when never saved and dirty.
- `Save` is only enabled when the draft differs from the saved value AND is within the limit. The button alone does not carry the unsaved-state signal. The `Unsaved changes` label next to it does.
- `Clear` empties both draft and saved value. No confirmation. Cheap to redo by pasting again.
- The textarea is 8 rows. Pasting more text scrolls inside the box, not the page.

## Empty chat surface

Shown after the gate is passed and before the first message.

```plaintext
+------------------------------------------------------------+
| [profile drawer collapsed]                                 |
| +--------------------------------------------------------+ |
| |                                                        | |
| |                       [sparkle]                        | |
| |                     Ask jobtriage                      | |
| |     Free-form chat over Swedish Platsbanken ads.       | |
| |                  Try one of these:                     | |
| |                                                        | |
| | ( Show me Stockholm AI engineering roles with        )|
| |   deadlines this month                                 |
| | ( Which active ads mention Azure ML and senior level   )|
| | ( Roles outside Stockholm that look like staff or      )|
| |   principal                                            |
| | ( Find ads with Hugging Face or Triton in the          )|
| |   description                                          |
| |                                                        | |
| | [ Ask about Swedish job ads...                       ↵]| |
| +--------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Behavior

- Seed chip rows wrap when they do not fit the column. Long chips truncate with an ellipsis. Hovering or focusing reveals the full text via the title attribute.
- Clicking a chip submits the chat turn directly. No intermediate edit step.

## Chat surface with cards and trace

Shown after at least one assistant turn has rendered.

```plaintext
+------------------------------------------------------------+
| [profile drawer collapsed]                                 |
| +--------------------------------------------------------+ |
| |                            [user message bubble]       | |
| |                                                        | |
| | +----------------------------------------------------+ | |
| | | Senior AI engineer                                 | | |
| | | Acme AB · Stockholm · Apply by May 21              | | |
| | | Open on Platsbanken ↗                              | | |
| | +----------------------------------------------------+ | |
| | +----------------------------------------------------+ | |
| | | (next ad card)                                     | | |
| | +----------------------------------------------------+ | |
| | [wrench] Triaged batch  [Completed]                  v | |
| |                                                        | |
| | One-line summary or judgment from the assistant.       | |
| |                                                        | |
| | [ Ask about Swedish job ads...                       ↵]| |
| +--------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Behavior

- Cards render above the trace tree. The trace tree is collapsed by default behind a one-line summary like `Triaged batch · Completed`. Engineers expand to inspect input and output JSON.
- Assistant text below the trace is a one-line summary or recommendation. Cards already carry headline, employer, location, deadline, and link. The text does not re-list the cards.
- Each tool name maps to a friendly label: `Searched JobTech filter`, `Hybrid retrieval`, `Matched profile to ad`, `Triaged batch`, `Compared roles`, `Deadline watch`, `Engagement status`.

## Card variants

Switch by which tool produced them. Layout below changes only the right-hand annotation.

### Default (semantic, search, triage)

```plaintext
+------------------------------------------------------+
| Senior AI engineer                                   |
| Acme AB · Stockholm · Apply by May 21                |
| Open on Platsbanken ↗                                |
+------------------------------------------------------+
```

### Deadline (deadlineWatch)

```plaintext
+------------------------------------------------------+
| Service Owner                          [Today]       |
| Volvo · Göteborg · Apply by May 8                    |
| Open on Platsbanken ↗                                |
+------------------------------------------------------+
```

The right-hand pill reads `Today`, `1 day left`, ..., `N days left`. The pill is informational, not interactive.

### Matched (matchProfile, compareRoles)

```plaintext
+------------------------------------------------------+
| Senior AI engineer                                   |
| Acme AB · Stockholm · Apply by May 21                |
| Open on Platsbanken ↗                                |
| Description excerpt: "Build agents in Stockholm      |
| with Azure ML and Mastra..."                         |
| Occupation label: Software developer                 |
+------------------------------------------------------+
```

### Empty list

```plaintext
+------------------------------------------------------+
| No ads matched that query. Try different keywords    |
| or a Swedish phrasing.                               |
+------------------------------------------------------+
```

Empty copy is per-tool. The defaults live in the trace component.

## Engagement status row

Renders for `trackStatus`. Has its own card shape, not the ad-card shape.

### Empty

```plaintext
+------------------------------------------------------------+
| Not tracked yet for 30966965. Engagement state is written  |
| from the CLI on the demo build.                            |
+------------------------------------------------------------+
| [wrench] Engagement status  [Completed]                  v |
+------------------------------------------------------------+
```

### With entries

```plaintext
+------------------------------------------------------------+
| 2026-04-30 · applied · Reached out via referral, link     |
|                          shared                            |
| 2026-04-15 · shortlisted                                   |
+------------------------------------------------------------+
| [wrench] Engagement status  [Completed]                  v |
+------------------------------------------------------------+
```

## Tool error

Renders when a tool call fails (input validation, upstream error, output validation).

```plaintext
+------------------------------------------------------------+
| [alert] Tool input invalid: extra fields not permitted     |
|         on deadlineWatch (got query)                       |
+------------------------------------------------------------+
| [wrench] Deadline watch  [Error]                         v |
+------------------------------------------------------------+
```

### Behavior

- The inline alert above the badge surfaces the actual validation message. No `Stream error` panic copy.
- The collapsible badge underneath holds the input and the structured error for engineers.
- The agent loop continues after a tool error. The next chunk is a corrected retry or a graceful fallback to a different tool.
- A top-level red banner over the whole conversation is reserved for stream-fatal errors that abort the run. Tool-level errors do not surface there.

## Input row

Always at the bottom of the conversation card. Pinned, not floating.

```plaintext
+------------------------------------------------------------+
| Ask about Swedish job ads...                            [↵]|
+------------------------------------------------------------+
```

### Behavior

- Submit on Enter. Shift-Enter inserts a newline.
- The submit button shows the stop icon while a response is streaming. Clicking it cancels the stream.
- The input clears on submit. No undo. The user can resubmit by retyping.

## Intentional omissions

- No login, no account, no chat history across sessions. Each browser tab is its own session per ARCHITECTURE.md § Per-session profile input.
- No mobile layout. Desktop-only is fine for v5. Responsive polish is queued for v6 if it happens.
- No copy-link, copy-message, or share-conversation affordances. Adding them invites a server-side persistence story this project does not have.
- No model selector inside the chat surface. Provider selection happens once at the BYOK gate. To switch, hit `Switch provider` in the header.
