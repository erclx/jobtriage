---
title: Export shortlist
description: Toolbar affordance pinned to the right end of the canvas view switcher
type: wireframe
---

# Export shortlist

Toolbar affordance pinned to the right end of the canvas view switcher. Lets a visitor download the pinned shortlist as a markdown or CSV file without leaving the page.

## Disabled (no pins)

```plaintext
[ Triage ][ Timeline ][ Compare ][ Shortlist ]      [↓ Export | v ]
                                                     ↑ tooltip: Pin an ad to enable export
```

## Enabled (pins present)

```plaintext
[ Triage ][ Timeline ][ Compare ][ Shortlist · 3 ]   [↓ Export · 3 | v ]
```

## Popover open

```plaintext
                                           +----------------------------+
                                           | File name                  |
                                           | [ acme-ab-senior-ai     ]  |
                                           | Saved as                   |
                                           | acme-ab-senior-ai_         |
                                           |   2026-05-12.md            |
                                           |                            |
                                           | [ Markdown ]  [ CSV ]      |
                                           +----------------------------+
```

## Dropdown open

```plaintext
                                           +-----------------+
                                           | Markdown (.md)  |
                                           | CSV (.csv)      |
                                           +-----------------+
```

## Behavior

- Both triggers stay disabled until at least one ad is pinned. The disabled tooltip reads `Pin an ad to enable export`.
- The badge on the primary button mirrors the pinned count, matching the Shortlist tab badge.
- Default file name derives from the first pinned ad's `employer` + `headline`, slugified to ASCII. Falls back to `shortlist` when the employer is missing. The user can rename in the input before emitting.
- The helper line under the input previews the final file name with the date suffix (`<slug>_YYYY-MM-DD.md`).
- Markdown ships title, employer plus municipality, deadline, link, and the per-ad rationale (profile-match rationale when available, otherwise the ad excerpt). Ends with a `> Exported from <demo URL>` footer line.
- CSV emits the same fields as one row per pinned ad, RFC 4180 escaped, with the demo URL appended as a trailing `# Exported from <url>` comment row.
- The chevron menu emits with the default file name without opening the popover. Use it when the slug is already fine.
- A transient `✓ Downloaded` chip appears under the button for 2.5 seconds after each successful emit (`role="status"`). A second click within 500 ms is ignored so a rapid double-click produces one download, not two.
- Escape closes both overlays without emitting.
