---
title: Agent conversation fixtures
description: Manual prompts to drive against /api/chat, seed for the v6 agent-eval harness
---

# Agent conversation fixtures

Manual chat prompts to drive against `/api/chat`. The v6 agent-eval harness will consume this file once it lands. UI-only cases for the canvas surface (pin, drag, rail resize, theme, dialog auto-save) live in `canvas-interactions.md`.

Each case keeps the prompt on a single line inside a `plaintext` block so it yanks cleanly in vim. Paste into the chat input on `http://127.0.0.1:3000`. Tick the matching box in the open PR's `## Testing` section after each run. Drop surprises in PR comments.

## Fixture format

Each numbered case is an H2 with the prompt as the first `plaintext` block. The remaining bullets carry metadata the harness will assert against:

- `Profile`: `required` if the prompt assumes the shared profile sits in the drawer. `optional` if the case runs identically with or without it.
- `Expected tools`: ordered list of tool names the model should call on this turn. `none` for pure conversational turns.
- `Expected behavior`: one or two lines describing the visible output. Used as the assertion text the harness will pattern-match.
- `Manual check`: visual gates a harness will not catch (card variant, trace header text, copy tone).
- `Watch for`: known regressions tied to v4 or v4.1 fixes. Treat as an alarm pattern in the harness.

Shared inputs live above the cases. Currently one shared `Profile` block. Add more shared blocks under their own H2 if a fixture needs them.

## Spatial pairing

Every data-tool call also fires its paired spatial tool in the same turn. The pairings are fixed by the system prompt:

| Data tool                      | Paired spatial tool                            |
| ------------------------------ | ---------------------------------------------- |
| `searchJobs`, `semanticSearch` | `placeAds`                                     |
| `triageBatch`                  | `groupAds` (or `placeAds` when no clear tiers) |
| `matchProfile`                 | `connectProfileToAds`                          |
| `compareRoles`                 | `pairAdsForCompare`                            |
| `deadlineWatch`                | `placeAdsOnTimeline`                           |
| `trackStatus`                  | `markStatus`                                   |

The `Expected tools` field below names the data tool only. The visible result also asserts the canvas changed: ad nodes appear in the matching view, edges spawn from the profile node when applicable, the timeline renders the today cursor, and so on. The spatial-pairing fixture (`agent-spatial-pairing.json`) drives the harness check.

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

## 12. Cluster triage on the canvas

```plaintext
Triage active machine learning roles into strong fits, consider, and pass.
```

- Profile: required
- Expected tools: `triageBatch`, then `groupAds`
- Expected behavior: canvas flips to Triage view with two or three labeled clusters. Cluster boundaries take tone classes from the label (`Strong fit` green, `Consider` amber, `Pass` muted). Each ad sits in exactly one cluster.
- Manual check: chat trace shows `Grouped N ads into M clusters` summary line. Cluster labels match the tones the agent used.
- Watch for: agent picking `placeAds` instead of `groupAds`. That regresses the v4.6 spatial-pairing rule for tiered triage.

## 13. Profile match edges on the canvas

Save a profile first via the header dialog.

```plaintext
Which of the active AI engineer roles match my profile?
```

- Profile: required
- Expected tools: `triageBatch`, then `connectProfileToAds`
- Expected behavior: canvas Triage view shows ad cards plus weighted bezier edges spawning from the profile node. Each edge carries a percentage label at the midpoint. Higher score draws thicker, more opaque edges.
- Manual check: AdNode renders the rationale block above the description excerpt with the percentage and one-line reason.
- Watch for: agent fabricating ad ids that did not appear in the prior `triageBatch` result. The edge will draw to nowhere visible.

## Deploy posture cases

These cases exercise the v4.10 live JobTech path (`lookupConcept` then live `searchJobs`) instead of the local SQLite corpus. The deploy posture fires automatically on the Anthropic branch. To exercise it from the local Ollama branch, append `?mode=deploy` to the chat URL (`http://127.0.0.1:3000/?mode=deploy`). The chat client then sends `x-jobtriage-mode: deploy` and the route honors it because Vercel is not set in the local env.

The structured fixture lives at `.claude/evals/agent-general-profile.json` and runs through `web/scripts/model-probe.ts` for automated regression.

## 14. Cross-profession search, nurse

Replace the shared profile with a nurse profile via the header dialog before this case:

```plaintext
# Profile

Licensed nurse (sjuksköterska), 6 years on a cardiology ward. Living in Stockholm, looking for a permanent ward role.
```

Then prompt:

```plaintext
Find nursing roles in Stockholm.
```

- Profile: required (nurse)
- Expected tools: `lookupConcept`, then `searchJobs`, then `placeAds`
- Expected behavior: canvas fills with real Swedish nursing ads (`Sjuksköterska` headlines) from JobTech live, not the local AI-engineering corpus. Each card carries employer, deadline, municipality, and an `arbetsformedlingen.se/platsbanken/...` link.
- Manual check: tool trace renders `lookupConcept` first, then `searchJobs` second. Cards show description excerpts. Reply text references one or two ads by headline, does not re-list every ad.
- Watch for: `triageBatch` or `semanticSearch` firing instead of `lookupConcept` plus `searchJobs`. That means the deploy posture did not engage. Check for `?mode=deploy` on the URL.

## 15. Cross-profession search, chef with Swedish translation

Replace the profile with a chef profile:

```plaintext
# Profile

Sous chef with 9 years in fine-dining kitchens, including 3 years at a Michelin-starred restaurant in Stockholm. Looking for a head-chef role at a small to mid-size restaurant in Stockholm or Uppsala.
```

Then prompt:

```plaintext
Find chef roles in Stockholm.
```

- Profile: required (chef)
- Expected tools: `lookupConcept`, then `searchJobs`, then `placeAds`
- Expected behavior: agent passes a Swedish profession term in the `searchJobs.query` field (`kock`, not `chef`, since `chef` means `boss` in Swedish). Cards show real `Kock`, `Köksmästare`, or `Chefskock` ads.
- Manual check: inspect the `searchJobs` tool input in the trace. It should contain `query` with a Swedish term. If it only sends `occupation_concept_id` without `query`, the Swedish-fallback prompt rule has regressed.
- Watch for: results coming back as nursing or wait-staff ads. That means the agent passed only `occupation_concept_id` and JobTech ignored or under-matched the filter.

## 16. Cross-profession search, marketer

Replace the profile with a marketer profile, then prompt:

```plaintext
Find marketing manager roles in Malmö or Copenhagen.
```

- Profile: required (marketer)
- Expected tools: `lookupConcept`, then `searchJobs`, then `placeAds`
- Expected behavior: canvas fills with marketing roles. If zero results match the strict filter, the agent may bail with a one-liner and skip `placeAds`. The harness scores that as a partial verdict, acceptable when the result set is genuinely empty.
- Manual check: empty-state messaging is honest. Reply must not pretend to have placed ads when it did not.
- Watch for: hallucinated Malmö ads. Cross-check at least one headline against `arbetsformedlingen.se/platsbanken/` to confirm the ad is real.

<!-- UI-only cases for the canvas surface (pin, drag, resize, theme, dialog auto-save) live in `canvas-interactions.md`. This file holds chat prompts only. -->
