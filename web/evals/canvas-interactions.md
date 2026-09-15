---
title: Canvas interaction fixtures
description: Manual UI test cases for the spatial canvas. No chat prompts. Run after a chat-driven case has populated the canvas.
---

# Canvas interaction fixtures

UI-only cases. The harness skips this file since there are no chat prompts to drive. Run these manually in the browser after a chat-driven case from `agent-conversations.md` has populated the canvas. Tick the matching box in the open PR's `## Testing` section.

Each case is an H2 with the precondition, the steps, the expected outcome, and the regression alarm. No `Expected tools` field since no tool fires from a UI case.

## 1. Pin and shortlist persistence

Precondition: run case 1 or 12 from `agent-conversations.md` so at least three ad cards sit on the Triage view.

- Click `Pin` on two ad cards. The button flips to `Pinned` with the unpin icon. The Shortlist chip badge increments to 2.
- Click the `Shortlist` chip in the canvas view switcher. Both cards sit in a vertical column.
- Reload the tab. The pinned set persists. Pinned ads still appear on Shortlist after reload.

Watch for: pin button toggling without persisting, or the Shortlist count going stale after refresh. Either means sessionStorage hydration broke.

## 2. View switching and node drag persist

Precondition: run case 1 from `agent-conversations.md` so ad cards sit on the Triage view.

- Drag any ad card to a new position. The card moves smoothly during the drag, not just on drop.
- Click `Timeline`, then click `Triage` again. The dragged card stays where you dropped it.
- Reload the tab. Position persists.

Watch for: positions resetting on view switch or on reload. Either means `nodePositions` is not flowing through the canvas state hydration. Also watch for the card snapping back to its origin during drag instead of following the cursor, which means the controlled-mode drag pattern broke.

## 3. Profile dialog auto-save on close

Precondition: a profile is already saved.

- Open the profile dialog from the header.
- Edit the textarea so it differs from the saved value. The unsaved-changes hint reads `Unsaved changes, will save on close` (amber).
- Click outside the dialog (or press Escape) without clicking `Save`. The dialog closes and the edits persist.
- Reopen the dialog. The new value is the saved value.

Watch for: the dialog closing silently and discarding edits. That means the close interceptor did not fire `setStored` before `onOpenChange(false)`.

## 4. Resizable rail persistence

Precondition: viewport at least 1024px wide.

- Drag the splitter between the chat rail and the canvas. The rail width changes smoothly.
- Release the splitter. Reload the tab. The rail width persists.
- Focus the splitter and press `←` / `→`. Width adjusts in 8px steps. Press with `Shift` for 32px steps.

Watch for: width snapping back on reload (sessionStorage write broke) or width shooting past the [320, 640] clamp.

## 5. Theme toggle propagates to canvas

Precondition: any canvas state.

- Toggle the theme in the header from light to dark, or dark to light.
- The canvas background dot grid, the zoom controls, and the edge strokes all flip palettes immediately.
- The profile node and ad node card colors flip too.

Watch for: zoom controls staying white in dark mode, or dot grid color staying high-contrast across themes. That means the React Flow `colorMode` prop or the `--xy-*` CSS overrides broke.
