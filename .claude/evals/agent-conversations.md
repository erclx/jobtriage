---
title: Agent conversation fixtures
description: Manual prompts to drive against /api/chat, seed for the v6 agent-eval harness
---

# Agent conversation fixtures

Manual prompts to drive against `/api/chat` during v4 testing. v6's agent-eval harness will consume this file once it lands.

Each case keeps the prompt on a single line inside a `plaintext` block so it yanks cleanly in vim. Paste into the chat input on `http://127.0.0.1:3000`. Tick the matching box in the open PR's `## Testing` section after each run. Drop surprises in PR comments.

## Fixture format

Each numbered case is an H2 with the prompt as the first `plaintext` block. The remaining bullets carry metadata the harness will assert against:

- `Profile`: `required` if the prompt assumes the shared profile sits in the drawer. `optional` if the case runs identically with or without it.
- `Expected tools`: ordered list of tool names the model should call on this turn. `none` for pure conversational turns.
- `Expected behavior`: one or two lines describing the visible output. Used as the assertion text the harness will pattern-match.
- `Manual check`: visual gates a harness will not catch (card variant, trace header text, copy tone).
- `Watch for`: known regressions tied to v4 or v4.1 fixes. Treat as an alarm pattern in the harness.

Shared inputs live above the cases. Currently one shared `Profile` block. Add more shared blocks under their own H2 if a fixture needs them.

## Profile

Paste this into the drawer for cases that reference it.

```plaintext
Senior ML engineer in Göteborg, Python and PyTorch, ten years experience, looking for AI/ML roles with model-training scope.
```

## 1. Triage and assess

```plaintext
Find machine learning engineer roles and tell me which one fits best.
```

- Profile: required
- Expected tools: `triageBatch`
- Expected behavior: ranked ad cards with description excerpts. Final text names a best-fit ad and references at least one profile signal (Python, PyTorch, ML, Göteborg).
- Manual check: cards render employer, deadline, snippet, link. Trace collapsed under `Triaged batch · Completed`.
- Watch for: model picking `semanticSearch` instead. That regresses the v4.1 fix.

## 2. Compare two ads

```plaintext
Compare ads 30990642 and 30966965 for me.
```

- Profile: optional
- Expected tools: `compareRoles`
- Expected behavior: two ad cards with description excerpts plus prose comparison naming at least one differentiating signal per ad.
- Manual check: matched-variant cards render the description excerpt. Trace header reads `Compared roles · Completed`.

## 3. Deadline window without region

```plaintext
Which ads have a deadline in the next two weeks?
```

- Profile: optional
- Expected tools: `deadlineWatch`
- Expected behavior: at least one ad ordered by soonest deadline. Model does NOT pass `region` argument.
- Manual check: cards render the amber ring and `N days left` countdown badge.
- Watch for: empty result. That regresses the v4.1 region-filter fix.

## 4. Deadline with explicit city

```plaintext
Which ads in Göteborg have a deadline this month?
```

- Profile: required
- Expected tools: `deadlineWatch`
- Expected behavior: returns ads. Model does NOT pass `region`. Göteborg is a city, not a JobTech region concept id. Filtering by Göteborg happens in the assistant text, not the tool input.
- Watch for: empty result. Means the model fell back to the v4 region-filter bug.

## 5. Engagement status, populated path

```plaintext
What's my engagement status on ad 30966965?
```

Pre-seed once before running this case.

```bash
cd python && uv run jobtriage mark-status 30966965 shortlisted --note "ML engineering Volvo Göteborg" --log ../var/engagements/log.md
```

- Expected tools: `trackStatus`
- Expected behavior: engagement-entry card renders at least one row.
- Manual check: card reads `Engagement log for 30966965` with date, status, note columns.

## 6. Engagement status, empty path

```plaintext
What's my status on ad 30951713?
```

- Expected tools: `trackStatus`
- Expected behavior: empty-state card renders. Final text acknowledges no record yet.
- Manual check: card reads `Not tracked yet for 30951713 ...` with the CLI-only note.

## 7. Empty-state copy on a no-match query

```plaintext
Find me astronaut roles in Kiruna.
```

- Profile: optional
- Expected tools: `triageBatch`
- Expected behavior: empty card renders. Model says no results plainly.
- Manual check: card reads `No ads to triage for that query.` Empty-state copy must not look like a tool failure.

## 8. Profile recall sanity

```plaintext
Can you see my profile?
```

- Profile: required
- Expected tools: none
- Expected behavior: model paraphrases at least two profile signals (role, location, stack, seniority) without calling any tool.
- Manual check: no ad cards render. Plain assistant text only.

## 9. Natural multi-tool on Anthropic

Switch the gate to Anthropic and paste a real `sk-ant-...` key before this case.

```plaintext
Find Volvo machine learning roles in Göteborg and check the top match against my profile.
```

- Profile: required
- Expected tools: `triageBatch`, then `matchProfile`
- Expected behavior: first tool surfaces ranked ads with excerpts. Second tool fetches detail for the top `ad_id` from the first result. Final text scores fit against the profile.
- Manual check: two trace headers render, both Completed. The `matchProfile` output renders the matched-variant card, not the error variant.
- Watch for: model passing an `ad_id` that did not appear in the prior tool result. That triggers the 404 error envelope.

## 10. Structured filter with explicit concept ids

```plaintext
Find roles with JobTech occupation concept id "DJh5_yyF_hEM" in region "reg-vastra".
```

- Expected tools: `searchJobs`
- Expected behavior: tool fires with the supplied concept ids. Returns ad metadata only.
- Manual check: cards render WITHOUT description excerpts. Trace header reads `Searched JobTech filter · Completed`.

## 11. Date awareness

```plaintext
Which deadlines are in the next 5 days, knowing today's date?
```

- Profile: optional
- Expected tools: `deadlineWatch`
- Expected behavior: model uses today's date from the system prompt without dodging. Calls `deadlineWatch` with `window_days` near 5.
- Watch for: model evading with `I don't have access to real-time information`. That regresses the v4.1 date-injection fix.
