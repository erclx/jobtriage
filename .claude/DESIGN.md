# Design

Capture visual intent and the decisions behind it: the why behind how things look. Not a style guide, component spec, or framework reference. Update this doc when a visual decision is made or a rule changes.

What belongs:

- Tokens described as intent ("mid gray, muted text"), not computed values. Exact values live in code.
- Layout constraints and sizing rules not obvious from wireframes
- Visual rules a developer could get wrong without guidance
- Non-obvious omissions ("no motion", "no custom icons") that prevent scope creep

What does not belong:

- CSS classes, computed values, component filenames, and prop names. Those live in code.
- UX copy and interaction flows, which live in WIREFRAMES.md
- Anything that requires updating every time the code is refactored

Use tables for token systems, one row per token. Use short bullets for component rules, one decision per line. Plain English over technical notation. If a section could be removed and the developer would still build it correctly from wireframes and code alone, remove it.

The `aitk design render` command reads the tables below and writes an HTML plus CSS preview to `.claude/review/design/`. Keep table headers and role names intact so the parser can find them.

## Personality

Calm utility, not a marketing site. Reads as a daily-driver tool a senior engineer trusts. Light by default, dark fully supported. Neutral grayscale with one red for failure states, no marketing gradients, no decorative color. Density is recruiter-readable, not dashboard-dense. The chat is the product. Chrome stays out of the way.

## Color

One row per role. Intent is a short phrase a human can picture. Value is a hex or a named system token.

| Role        | Intent                                               | Value                 |
| ----------- | ---------------------------------------------------- | --------------------- |
| background  | page canvas, near-white in light, near-black in dark | `--background`        |
| surface     | cards, panels, raised blocks                         | `--card`              |
| text        | primary body text                                    | `--foreground`        |
| muted       | secondary text, helper, captions                     | `--muted-foreground`  |
| accent      | borders, dividers, subtle separators                 | `--border`            |
| primary     | filled buttons, headline emphasis                    | `--primary`           |
| destructive | tool errors, validation alerts                       | `--destructive`       |
| warning     | unsaved changes hint on the profile drawer           | amber-600 / amber-400 |

Notes:

- The palette is intentionally monochrome. Only destructive (red) and warning (amber) carry hue, and only on alert affordances. Any new hue belongs in this table or it does not ship.
- Dark mode is a token swap, not a re-tone. A light surface lifts. A dark surface still feels neutral.

## Typography

One row per role. Size and line height in pixels or rem. Family names use their product casing.

| Role    | Family           | Weight | Size | Line height |
| ------- | ---------------- | ------ | ---- | ----------- |
| display | Geist            | 600    | 18px | 1.4         |
| heading | Geist            | 500    | 16px | 1.4         |
| body    | Geist            | 400    | 14px | 1.5         |
| label   | Geist            | 500    | 14px | 1.4         |
| code    | system monospace | 400    | 12px | 1.5         |

Notes:

- One sans family across the surface. The profile drawer textarea uses monospace so pasted markdown looks like a file, not prose.
- No display-size text. The largest rendered string is the page title at 18px. Nothing should outweigh the cards.

## Spacing

Base unit and scale. The renderer draws a swatch per step. Base unit is 4px (`gap-1`).

| Step | Multiplier | Value |
| ---- | ---------- | ----- |
| xs   | 0.5        | 2px   |
| sm   | 1          | 4px   |
| md   | 2          | 8px   |
| lg   | 3          | 12px  |
| xl   | 5          | 20px  |

Notes:

- Card-to-card gap is `md`. Card-to-trace gap is `md`. Section gap inside the chat column is `lg`. Page gutter on the chat column is `lg`.
- Maximum chat column width is 768px (`max-w-3xl`). The BYOK gate caps at 448px (`max-w-md`). These widths are deliberate density choices, not arbitrary.

## Borders

| Role    | Radius | Width | When used                       |
| ------- | ------ | ----- | ------------------------------- |
| default | 8px    | 1px   | cards, inputs, buttons, badges  |
| pill    | 999px  | 1px   | seed query chips, status pills  |
| none    | 0      | 0     | conversation column inner edges |

Notes:

- Border colour is the `accent` token (very low contrast against background). The shape carries hierarchy, not the line weight.
- Focus rings come from `--ring`. Do not redefine focus styles per component.

## Motion

Motion is reserved for state changes the user must register: chevron rotation on collapsibles, fade on theme switch, the typing indicator on the chat input. No entrance animations on cards, no parallax, no decorative motion. Default duration 150ms with the default Tailwind ease.

## Iconography

Lucide outline icons only. 1.5px stroke, 16px or 20px box. No custom icons, no filled variants, no third-party icon set. Functional icons (Switch provider, Profile, Theme toggle, Tool trace badges) carry an `aria-label` or accompany visible text. Decorative icons mark `aria-hidden`.
