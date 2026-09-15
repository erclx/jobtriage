---
description: Ban personal names and internal-only paths from public-repo output
---

# Public repo hygiene standards

## Content

- Do not write personal names into READMEs, `.claude/` or `canon/` planning docs, source comments, or commit messages. Use neutral phrasing ("the user", "a recruiter", "a local file").
- Treat content under `.canon/tmp/` as local context, not output.
- Do not cite a `.canon/` path (tasks, plans, review, tmp) from a PR body, README, or other reviewer-facing artifact. Inline the context or say "queued as a follow-up" instead.
