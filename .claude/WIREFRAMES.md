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

Spans the top of the workspace. Does not appear on the BYOK gate.

```plaintext
+----------------------------------------------------------------------+
| jobtriage              [user] Profile · 412  [✨ New]  [moon] [Out]  |
| Spatial agent workspace over Swedish JobTech ads                     |
+----------------------------------------------------------------------+
```

### Behavior

- The profile button shows `Add profile` when no profile is saved and `Profile · N chars` when the session has one. Clicking opens the profile dialog.
- `New chat` opens a confirm dialog before clearing the conversation, the canvas state, and the pinned shortlist. Profile, provider, and key stay. The button is disabled while a response is streaming and when chat plus canvas plus shortlist are already empty.
- `Switch provider` opens a confirm dialog. Cancel keeps the current session. Confirm clears the stored key, provider, chat, and canvas, then returns the user to the BYOK gate. The saved profile stays. Anonymous, single-session.
- The moon icon toggles between light, dark, and system. Tooltip on hover names the next state.
- Subtitle stays visible at all viewport widths. The header does not shrink to a logo bar.

## Profile dialog

Opens from the header profile button. Replaces the prior collapsed drawer that sat above the chat surface.

```plaintext
+--------------------------------------------------------+
| Profile                                            [x] |
| Paste markdown describing your role, location,         |
| must-haves, or deal-breakers. Forwarded with every     |
| chat turn. Held only in this browser tab and never     |
| persisted on the server.                               |
|                                       [ Load example ] |
| +----------------------------------------------------+ |
| | ## Role                                            | |
| | Senior AI engineer                                 | |
| | ## Must-haves                                      | |
| | Stockholm, agentic systems, RAG, hybrid retrieval  | |
| +----------------------------------------------------+ |
| 412 / 20,000 chars             Unsaved changes (amber) |
|                                       [Clear]  [Save] |
+--------------------------------------------------------+
```

### Behavior

- `Load example` is only shown when the draft is empty. It fills the textarea with a short example profile and marks the draft dirty.
- `Save` is only enabled when the draft differs from the saved value AND is within the limit. The `Unsaved changes, will save on close` label next to the buttons carries the dirty signal and tells the user the close interceptor will commit.
- `Clear` empties both draft and saved value. No confirmation. Cheap to redo by pasting again.
- The textarea grows to fill available height. Long pastes scroll inside the box, not the page.
- Dialog dismisses with Escape, the close button, or clicking outside. The wrapper intercepts the close transition, persists the draft to sessionStorage if dirty and within the char limit, and only then allows the dialog to close. Over-limit drafts discard since `Save` would have blocked them anyway.

## Profile node

Anchored to the top-left of every canvas view, never deleted. The profile node is always present even when no profile is saved.

### Empty

```plaintext
+--------------------------+
| [user] PROFILE           |
|                          |
| No profile yet           |
| Click to add criteria    |
+--------------------------+
```

### Saved

```plaintext
+--------------------------+
| [user] PROFILE        [✎]|
|                          |
| Senior AI engineer       |
| 412 chars · click to     |
| edit                     |
+--------------------------+
```

### Behavior

- Single click or double click opens the profile dialog. Both work.
- The headline summary pulls the first non-heading line from the saved markdown and truncates at 64 characters.
- When `connectProfileToAds` fires, edges spawn from the right handle of this node to matched ads on the canvas. Each edge takes the matching tone (emerald, amber, muted) and scales width plus opacity by score. The percentage number lives inside the ad card's match rationale row, not on the edge itself, so the line stays a clean visual thread.

## Workspace layout

Two columns above 1024px wide. Below 1024px the canvas hides and the chat rail fills the column.

```plaintext
+------------------------+----------------------------------+
| jobtriage      [✎]    | [Triage][Timeline][Compare][Pin] |
| ...                    |                                  |
+------------------------+----------------------------------+
| user: which active     |                                  |
| Stockholm AI roles     |   +------+ +------+ +------+    |
|                        |   | ad   | | ad   | | ad   |    |
| > Triaged batch (5)    |   +------+ +------+ +------+    |
|                        |                                  |
|                        |   [profile node]                 |
|                        |                                  |
|                        | [+] [-] [fit]                    |
| [Ask about ads...] [↵] |                                  |
+------------------------+----------------------------------+
```

- Left rail starts at 380px and is resizable between 320 and 640 via the splitter. Below `lg` the canvas and splitter hide and the rail fills the viewport.
- The splitter sits between the rail and the canvas. A small vertical pill in the middle of the column signals that it is draggable at rest and grows on hover or keyboard focus. Width persists in sessionStorage. `←` and `→` adjust by 8px (32px with Shift).
- Chat rail holds the conversation, the tool trace tree (collapsed by default), one-line spatial-tool summaries, the empty state with seed chips, and the prompt input pinned to the bottom.
- Canvas holds the view switcher chips at top, the React Flow surface in the middle, and the zoom controls at bottom-left. Below `lg` a static notice in the chat rail reads `Best viewed on a desktop. The spatial canvas needs at least 1024px.`.

## Empty workspace

Shown after the gate is passed and before the first message.

```plaintext
+----------------------------------+--------------------------------+
|                                  | [Triage][Timeline][Compare]... |
| [sparkle]                        |                                |
| Ask jobtriage                    |   +-------------+              |
| Spatial agent workspace over     |   | PROFILE     |              |
| Swedish Platsbanken ads.         |   | No profile  |              |
| Try one of these:                |   | yet         |              |
|                                  |   +-------------+              |
| ( Stockholm AI roles ... )       |                                |
| ( Active ads with Azure ML )     |   Ask a question on the left   |
| ( Roles outside Stockholm ... )  |   and the agent will populate  |
| ( Hugging Face or Triton )       |   this canvas with ad cards,   |
|                                  |   clusters, and timeline       |
| [Ask about Swedish job ads...] [↵]|  placements as it reasons.     |
+----------------------------------+--------------------------------+
```

### Behavior

- The empty state stacks the sparkle, headline, seed chips, and prompt input as one vertically-centered block inside the chat card. After the first message the prompt slides to the bottom and pins for the rest of the session.
- Seed chip rows wrap when they do not fit the column. Long chips truncate with an ellipsis. Hovering or focusing reveals the full text via the title attribute.
- Clicking a chip submits the chat turn directly. No intermediate edit step.

## Chat rail conversation

Shown in the left rail after at least one assistant turn has rendered.

```plaintext
+----------------------------------+
|                  [user bubble]   |
|                                  |
| > Triaged batch  [Completed]   v |
|                                  |
| Three roles look strong, two are |
| stretches. See the canvas.       |
|                                  |
| [Ask about Swedish job ads...] ↵ |
+----------------------------------+
```

### Behavior

- The chat rail no longer renders ad cards inline. Cards live on the canvas to the right. The rail keeps user bubbles, assistant text, and the data-tool trace tree (collapsed).
- Spatial tool parts (`placeAds`, `groupAds`, `connectProfileToAds`, `pairAdsForCompare`, `placeAdsOnTimeline`, `pinToShortlist`, `markStatus`, `setView`) render as a single muted summary line per call (`Placed 5 ads on the canvas`, `Grouped 4 ads into 3 clusters`, `Connected profile to 4 ads`, etc.). The trace tree is reserved for data-tool inputs and outputs.
- The summary line keeps the chat path identical on desktop and mobile, so a user without the canvas still sees evidence of the agent's work.
- Assistant text below the trace is a one-line summary or recommendation. The canvas carries the cards. The text carries the judgment.
- Each data tool name maps to a friendly label: `Searched JobTech filter`, `Hybrid retrieval`, `Matched profile to ad`, `Triaged batch`, `Compared roles`, `Deadline watch`, `Engagement status`.

## Canvas views

The view switcher chips at the top of the canvas drive the layout. The agent flips views via spatial tool calls and the user can flip them manually.

### Triage view (default)

Shown after `placeAds` or `groupAds`. Plain grid when the agent passes flat ad ids. Labeled clusters when the agent passes a `groups` payload.

```plaintext
+----------------------------------------------------+
| [Strong fit · 3]    [Consider · 2]                 |
|                                                    |
|  +---------+ +---------+    +---------+ +--------+ |
|  | ad      | | ad      |    | ad      | | ad     | |
|  +---------+ +---------+    +---------+ +--------+ |
|  +---------+                                       |
|  | ad      |                                       |
|  +---------+                                       |
+----------------------------------------------------+
```

### Timeline view

Shown after `placeAdsOnTimeline`. Ads laid out on a date axis ordered by `application_deadline`. Lane stacking prevents overlap when two ads share a date.

```plaintext
+----------------------------------------------------+
| Today                +5d              +14d         |
|   |                   |                  |         |
|  +--------+         +--------+        +--------+   |
|  | ad     |         | ad     |        | ad     |   |
|  +--------+         +--------+        +--------+   |
|         +--------+                                 |
|         | ad     |                                 |
|         +--------+                                 |
+----------------------------------------------------+
```

### Compare view

Shown after `pairAdsForCompare`. Two ads side by side with a structured diff overlay.

```plaintext
+----------------------------------------------------+
|  +-----------------+      +-----------------+      |
|  | ad A            |      | ad B            |      |
|  | Acme AB         |      | Beta AB         |      |
|  | Stockholm       |      | Göteborg        |      |
|  | Excerpt...      |      | Excerpt...      |      |
|  +-----------------+      +-----------------+      |
|                                                    |
|  Stack:    Azure ML (a)                            |
|  Location: Stockholm (a) vs Göteborg (b)           |
|  Seniority: same                                   |
+----------------------------------------------------+
```

### Shortlist view

Shown when the user clicks the Shortlist chip or the agent calls `setView` with `shortlist`. Pinned ads stack vertically. The chip badge shows the pinned count.

```plaintext
+----------------------------------------------------+
| +------------------+                               |
| | ad (pinned)      |                               |
| | applied · note   |                               |
| +------------------+                               |
| +------------------+                               |
| | ad (pinned)      |                               |
| +------------------+                               |
+----------------------------------------------------+
```

### Ad node anatomy

```plaintext
+----------------------------------+
| Senior AI engineer    [3 days]   |
| Acme AB · Stockholm              |
| Apply by May 21                  |
|                                  |
| 78% · Stockholm + Azure ML       | <- match rationale (only when connected)
|                                  |
| Build agents in Stockholm with   |
| Azure ML and Mastra...           |
|                                  |
| Open on Platsbanken ↗      [Pin] |
+----------------------------------+
```

### Behavior

- Deadline pill on the top right reads `Today`, `1 day left`, ..., `N days left`. Pill is informational only.
- Match rationale block renders only when the profile node is connected to this ad via `connectProfileToAds`. Score is shown as a percentage.
- Pin button toggles between `Pin` and `Pinned`. Pinned ads also appear on the Shortlist view.
- Open on Platsbanken opens the live ad in a new tab.

### Canvas empty state

When no ads have been placed in the current session, the canvas shows the profile node alone on the dotted background. No additional overlay copy. The chat rail's empty state (sparkle, headline, seed chips) is the only onboarding surface. The view switcher chips and the profile node together signal that ad cards will land here.

## Engagement status row

Renders inline in the chat rail trace for `trackStatus`. Has its own card shape, not the ad-card shape. Status decoration also flows to the matching shortlist node when the agent chains `markStatus`.

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

Always at the bottom of the chat rail. Pinned, not floating.

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
