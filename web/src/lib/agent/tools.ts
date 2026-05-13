import 'server-only'

import { tool } from 'ai'

import { spatialTools } from '@/lib/agent/spatial-tools'
import * as api from '@/lib/api/client'
import {
  DeadlineRequestSchema,
  EngagementStatusRequestSchema,
  JobDetailsRequestSchema,
  JobSearchRequestSchema,
  LiveJobDetailsRequestSchema,
  LiveJobSearchRequestSchema,
  LookupConceptRequestSchema,
  SemanticSearchRequestSchema,
  TriageRequestSchema,
} from '@/lib/api/schemas'

const dataTools = {
  searchJobs: tool({
    description:
      'Structured filter against the JobTech JobSearch API. Use ONLY when the user or a prior tool result supplied a real JobTech concept id. Concept ids are 12-char nanoids in the form "X9jv_K2b_m48" (4-3-3 alphanumeric segments). Never invent or paraphrase a concept id; if you do not have one, use semanticSearch or triageBatch instead. Returns ad metadata only, no description text.',
    inputSchema: JobSearchRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.searchJobs(input, { signal: abortSignal })
    },
  }),
  semanticSearch: tool({
    description:
      'Hybrid retrieval (BM25 + dense embeddings + reciprocal rank fusion) over indexed Swedish description text. Returns ranked ad metadata WITHOUT description excerpts. Prefer triageBatch for almost every query, since triageBatch returns the same ranking PLUS excerpts in one call. Use this only when the user wants a bare list and explicitly does not want per-ad reasoning.',
    inputSchema: SemanticSearchRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.semanticSearch(input, { signal: abortSignal })
    },
  }),
  matchProfile: tool({
    description:
      'Fetch one ad with its description excerpt so you can score the fit against the USER PROFILE in the system prompt. Use after the user asks how a specific ad matches them. Pass exactly one ad_id from a prior search result.',
    inputSchema: JobDetailsRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.getJobDetails(input, { signal: abortSignal })
    },
  }),
  triageBatch: tool({
    description:
      'Hybrid retrieval that returns ranked ads WITH description excerpts in one round trip. This is the default tool for any "find me ads about X" or "find X and tell me which fits best" intent, since the excerpts let you reason about per-ad fit against the USER PROFILE without a follow-up tool call. Default top_k is 5 to fit local-model context windows.',
    inputSchema: TriageRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.triageBatch(input, { signal: abortSignal })
    },
  }),
  compareRoles: tool({
    description:
      'Compare two or more ads side by side: fetches employer, deadline, and description excerpt per ad in parallel. Anchor on the verb "compare". Use this whenever the user asks to compare, contrast, or pick between roles. Typical chain: call triageBatch first to surface candidate ad_ids, then call compareRoles on the top two or three. Do not re-run retrieval as a fake comparison. Pass at least two ad_ids; ten max.',
    inputSchema: JobDetailsRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.getJobDetails(input, { signal: abortSignal })
    },
  }),
  deadlineWatch: tool({
    description:
      'List active ads whose application deadline falls within the next window_days, ordered by soonest. Inputs are window_days (1-365, required) and region (optional JobTech region concept id like "reg-vastra"). This tool has NO query, employer, or keyword field; it is a pure deadline filter. For semantic deadline queries ("agentic roles expiring this month") chain semanticSearch or triageBatch first, then deadlineWatch on the surfaced corpus mentally. Omit region whenever the user mentions a city, since city names live on the municipality field, not region. Read the current date from the system prompt rather than guessing.',
    inputSchema: DeadlineRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.deadlineWatch(input, { signal: abortSignal })
    },
  }),
  trackStatus: tool({
    description:
      'Read engagement-log entries for one ad_id (shortlisted, applied, declined). Empty list means no record yet. Engagement state is written by the CLI; the deployed demo is read-only.',
    inputSchema: EngagementStatusRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.getEngagementStatus(input, { signal: abortSignal })
    },
  }),
} as const

const deployDataTools = {
  lookupConcept: tool({
    description:
      'Resolve a free-text term (occupation name like "nurse", "marketer", or a Swedish region or city) to JobTech taxonomy concept ids. Returns up to top_k matches across both occupation and region taxonomies; each result carries a "type" field ("occupation" or "region") so you can route the id into the right searchJobs field. ALWAYS call this before searchJobs when the user names a profession, role, or place; never invent concept ids.',
    inputSchema: LookupConceptRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.lookupConcept(input, { signal: abortSignal })
    },
  }),
  searchJobs: tool({
    description:
      'Free-text plus structured live search against the JobTech (Platsbanken) public API. Returns active Swedish ads with description excerpts inline, so you can reason about per-ad fit against the USER PROFILE without a follow-up tool call. ALWAYS pass `query` with the user\'s profession term in Swedish ("kock" not "chef", "sjuksköterska" not "nurse"). Optionally also pass `occupation_concept_id` (from a lookupConcept result with type "occupation") and `region` (from a lookupConcept result with type "region"). Free-text matches reliably; the concept-id filter is narrower and may miss adjacent roles, so never omit `query`. Default top_k is 5. NEVER invent concept ids; resolve them via lookupConcept first. If you receive a 422 about `occupation_concept_id`, the id was invalid: call lookupConcept with the user\'s term, take the top occupation result, and retry. Validator errors are recoverable, not terminal, never apologize to the user instead of retrying.',
    inputSchema: LiveJobSearchRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.liveSearchJobs(input, { signal: abortSignal })
    },
  }),
  matchProfile: tool({
    description:
      'Fetch one live JobTech ad with a description excerpt so you can score the fit against the USER PROFILE in the system prompt. Use after the user names a specific ad and asks how it matches them. Pass exactly one ad_id from a prior searchJobs result.',
    inputSchema: LiveJobDetailsRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.liveGetJobDetails(input, { signal: abortSignal })
    },
  }),
  compareRoles: tool({
    description:
      'Fetch live JobTech excerpts for two or more ad_ids in parallel for a side-by-side comparison. Anchor on the verb "compare". After searchJobs surfaces candidate ad_ids, chain into compareRoles to render the side-by-side variant; do not re-run searchJobs to fake a comparison. Pass at least two ad_ids; ten max.',
    inputSchema: LiveJobDetailsRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.liveGetJobDetails(input, { signal: abortSignal })
    },
  }),
  trackStatus: dataTools.trackStatus,
} as const

export const jobtriageTools = {
  ...dataTools,
  ...spatialTools,
} as const

export const deployJobtriageTools = {
  ...deployDataTools,
  ...spatialTools,
} as const

export type JobtriageTools = typeof jobtriageTools
export type DeployJobtriageTools = typeof deployJobtriageTools
