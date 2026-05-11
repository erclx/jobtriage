---
title: Diagram standard
description: Conventions for Mermaid diagrams in `.claude/DIAGRAMS.md` and elsewhere
---

# Diagram standard

Applies to Mermaid diagrams in `.claude/DIAGRAMS.md` and any other markdown that embeds one. Goal: diagrams that render cleanly inside VS Code's Mermaid preview (narrow column) and read pedagogically without prose context.

## Layout

- Use `flowchart TB` (top-bottom) by default. Vertical stacks render inside the VS Code preview without horizontal scroll.
- Avoid `flowchart LR` and side-by-side subgraphs. They overflow the editor pane on most monitors.
- Keep node labels short. Three or four words max. Detail goes in the paragraph below the diagram.
- Use `<br/>` for a second short line on a node when the label is two ideas, never for a sentence.
- Subgraphs are for grouping unrelated lanes (offline versus online, browser versus server). Do not subgraph a single linear flow.

## Narrative

- Build a narrative arc across the file, not a parallel list of unrelated views. Start with the whole system in five or six boxes. Drill into one phase per section.
- Order sections chronologically when possible: framing, then setup, then a query travels through, then measurement.
- One H2 per diagram. The H2 names what the diagram answers, not what it shows ("How the corpus gets populated", not "Corpus ingestion").

## Explanation

- One to three short paragraphs below each diagram. Plain English, pedagogical, no marketing copy.
- Lead with what the diagram shows. Follow with why this shape was chosen and what alternative was rejected, when the choice was non-obvious.
- Reference one or two specific code paths the reader can open. Do not enumerate every file.
- Do not duplicate prose between sections. Each paragraph earns its line.

## Maintenance

- When the system changes (new layer, new provider, new deploy posture), audit `.claude/DIAGRAMS.md` in the same PR. A diagram showing a defunct host or library is worse than no diagram.
- Mermaid blocks are inside fenced code, so the prose-standards hook ignores them. The explanation paragraph below is still prose. Follow `standards/prose.md`.
