import 'server-only'

import { tool } from 'ai'

import * as api from '@/lib/api/client'
import {
  JobSearchRequestSchema,
  SemanticSearchRequestSchema,
} from '@/lib/api/schemas'

export const jobtriageTools = {
  searchJobs: tool({
    description:
      'Structured filter against the JobTech JobSearch API. Use when the user constrains by employer, region, or occupation taxonomy code (concept id). Returns ad metadata only — no description text. Pair with semanticSearch when both filter and semantic intent are present.',
    inputSchema: JobSearchRequestSchema,
    execute: async (input, { abortSignal }) => {
      const response = await api.searchJobs(input, { signal: abortSignal })
      return response
    },
  }),
  semanticSearch: tool({
    description:
      'Hybrid retrieval (BM25 + dense embeddings + reciprocal rank fusion) over indexed Swedish description text. Use when the user describes the role in natural language, names skills, technologies, or seniority. Returns ranked ads with relevance scores.',
    inputSchema: SemanticSearchRequestSchema,
    execute: async (input, { abortSignal }) => {
      const response = await api.semanticSearch(input, { signal: abortSignal })
      return response
    },
  }),
} as const

export type JobtriageTools = typeof jobtriageTools
