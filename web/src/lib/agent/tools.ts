import 'server-only'

import { tool } from 'ai'

import * as api from '@/lib/api/client'
import {
  DeadlineRequestSchema,
  EngagementStatusRequestSchema,
  JobDetailsRequestSchema,
  JobSearchRequestSchema,
  SemanticSearchRequestSchema,
  TriageRequestSchema,
} from '@/lib/api/schemas'

export const jobtriageTools = {
  searchJobs: tool({
    description:
      'Structured filter against the JobTech JobSearch API. Use when the user constrains by employer, region, or occupation taxonomy code (concept id). Returns ad metadata only — no description text. Pair with semanticSearch when both filter and semantic intent are present.',
    inputSchema: JobSearchRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.searchJobs(input, { signal: abortSignal })
    },
  }),
  semanticSearch: tool({
    description:
      'Hybrid retrieval (BM25 + dense embeddings + reciprocal rank fusion) over indexed Swedish description text. Use when the user describes the role in natural language, names skills, technologies, or seniority. Returns ranked ads with relevance scores.',
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
      'Run hybrid retrieval and return the top ads with description excerpts in one call. Use when the user wants a sweep + per-ad triage in a single turn. Default top_k is 5 to fit local-model context windows.',
    inputSchema: TriageRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.triageBatch(input, { signal: abortSignal })
    },
  }),
  compareRoles: tool({
    description:
      'Fetch detail (employer, deadline, description excerpt) for two or more ads in parallel. Use when the user names multiple ad_ids and asks for a side-by-side comparison. Pass at least two ad_ids; ten max.',
    inputSchema: JobDetailsRequestSchema,
    execute: async (input, { abortSignal }) => {
      return api.getJobDetails(input, { signal: abortSignal })
    },
  }),
  deadlineWatch: tool({
    description:
      'List active ads whose application deadline falls within the next window_days, ordered by soonest. Use when the user asks about expiring or time-sensitive ads. Optional region filter.',
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

export type JobtriageTools = typeof jobtriageTools
