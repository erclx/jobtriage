---
description: Enforce the live-smoke and push-signal discipline for shipping a feature
---

# Shipping standards

## Verification

- Run `bun run check` plus the test suite for the touched surfaces after implementing a feature. Fix what fails before opening a PR.
- Run a feature end-to-end against real data (live API, populated database, deployed surface) after implementing it, and paste the output into the PR body under a `Live smoke` section. State explicitly when a live run is impossible instead of claiming success.

## PR hygiene

- Keep PR bodies evergreen. Route run logs, follow-up notes, and polish narratives to PR comments via `gh pr comment`, not the body.

## Push gating

- Stop and hand control back after a local commit on a feature branch. Push only when the user signals after browser verification.
- Treat `/toolkit:git-ship` and `/toolkit:git-followup` as exempt for the invocation that calls them. Require a fresh push signal for a manual edit made between skill invocations.
