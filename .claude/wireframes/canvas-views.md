---
title: Canvas views
description: The view switcher chips at the top of the canvas drive the layout
type: wireframe
---

# Canvas views

The view switcher chips at the top of the canvas drive the layout. The agent flips views via spatial tool calls and the user can flip them manually.

## Triage view (default)

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

## Timeline view

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

## Compare view

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

## Shortlist view

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

## Shortlist empty state

When the Shortlist chip is active and `pinnedAdIds.length === 0`, a centered card overlays the canvas with onboarding copy and a one-click jump back to the triage view.

```plaintext
+----------------------------------------------------+
|                                                    |
|              +--------------------------+          |
|              | No pinned ads yet        |          |
|              | Pin ads from the triage  |          |
|              | view to build a shortlist|          |
|              | [ Go to triage ]         |          |
|              +--------------------------+          |
|                                                    |
+----------------------------------------------------+
```

## Ad node anatomy

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

## Behavior

- Deadline pill on the top right reads `Today`, `1 day left`, ..., `N days left`. At `days_until_deadline <= 1` the pill switches to the amber warning tone to match the existing ring on the card.
- Match rationale block renders only when the profile node is connected to this ad via `connectProfileToAds`. Score is shown as a percentage.
- Pin button toggles between `Pin` and `Pinned`. A rapid double-click is ignored within 250 ms so the second click does not undo the first. Pinned ads also appear on the Shortlist view.
- Open on Platsbanken opens the live ad in a new tab.
- View switcher chips are a button group with `aria-pressed` per chip, not a `role="tab"` widget. Arrow-key navigation is intentionally not exposed.

## Canvas empty state

When no ads have been placed in the current session, the canvas shows the profile node alone on the dotted background. No additional overlay copy. The chat rail's empty state (sparkle, headline, seed chips) is the only onboarding surface. The view switcher chips and the profile node together signal that ad cards will land here.

## Export shortlist

See [export-shortlist.md](export-shortlist.md) for the toolbar group, popover, and behavior bullets.
