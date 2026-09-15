---
title: Engagement status row
description: Renders inline in the chat rail trace for trackStatus
type: wireframe
---

# Engagement status row

Renders inline in the chat rail trace for `trackStatus`. Has its own card shape (`EngagementStatusCard` in `web/src/features/chat/engagement-status.tsx`), not the ad-card shape. Status decoration also flows to the matching shortlist node when the agent chains `markStatus`.

## Empty

```plaintext
+------------------------------------------------------------+
| Not tracked yet for 30966965. Engagement state is written  |
| from the CLI on the demo build.                            |
+------------------------------------------------------------+
| [wrench] Engagement status  [Completed]                  v |
+------------------------------------------------------------+
```

## With entries

```plaintext
+------------------------------------------------------------+
| Engagement log for 30966965                                |
| 2026-04-30 · applied · Reached out via referral, link     |
|                          shared                            |
| 2026-04-15 · shortlisted                                   |
+------------------------------------------------------------+
| [wrench] Engagement status  [Completed]                  v |
+------------------------------------------------------------+
```
