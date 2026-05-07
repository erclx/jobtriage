import { z } from 'zod'

export const AdSummarySchema = z
  .object({
    ad_id: z.string(),
    headline: z.string(),
    employer_name: z.string().nullable().optional(),
    municipality: z.string().nullable().optional(),
    application_deadline: z.string().nullable().optional(),
    webpage_url: z.string().nullable().optional(),
  })
  .strict()

export const RankedAdSchema = AdSummarySchema.extend({
  score: z.number(),
}).strict()

export const JobSearchRequestSchema = z
  .object({
    occupation_concept_id: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    top_k: z.number().int().min(1).max(50).default(10),
  })
  .strict()

export const JobSearchResponseSchema = z
  .object({
    results: z.array(AdSummarySchema),
  })
  .strict()

export const SemanticSearchRequestSchema = z
  .object({
    query: z.string().min(1).max(512),
    top_k: z.number().int().min(1).max(50).default(10),
  })
  .strict()

export const SemanticSearchResponseSchema = z
  .object({
    results: z.array(RankedAdSchema),
  })
  .strict()

export type AdSummary = z.infer<typeof AdSummarySchema>
export type RankedAd = z.infer<typeof RankedAdSchema>
export type JobSearchRequest = z.input<typeof JobSearchRequestSchema>
export type JobSearchResponse = z.infer<typeof JobSearchResponseSchema>
export type SemanticSearchRequest = z.input<typeof SemanticSearchRequestSchema>
export type SemanticSearchResponse = z.infer<
  typeof SemanticSearchResponseSchema
>
