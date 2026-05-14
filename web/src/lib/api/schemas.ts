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

export const AdDetailSchema = AdSummarySchema.extend({
  description_excerpt: z.string(),
  occupation_label: z.string().nullable().optional(),
}).strict()

export const TriagedAdSchema = RankedAdSchema.extend({
  description_excerpt: z.string(),
}).strict()

export const DeadlineAdSchema = AdSummarySchema.extend({
  days_until_deadline: z.number().int().min(0),
}).strict()

export const JobDetailsRequestSchema = z
  .object({
    ad_ids: z.array(z.string().min(1)).min(1).max(10),
  })
  .strict()

export const JobDetailsResponseSchema = z
  .object({
    results: z.array(AdDetailSchema),
  })
  .strict()

export const TriageRequestSchema = z
  .object({
    query: z.string().min(1).max(512),
    top_k: z.number().int().min(1).max(10).default(5),
  })
  .strict()

export const TriageResponseSchema = z
  .object({
    results: z.array(TriagedAdSchema),
  })
  .strict()

export const DeadlineRequestSchema = z
  .object({
    window_days: z.number().int().min(1).max(365).default(14),
    region: z.string().min(1).optional(),
    top_k: z.number().int().min(1).max(50).default(10),
  })
  .strict()

export const DeadlineResponseSchema = z
  .object({
    results: z.array(DeadlineAdSchema),
  })
  .strict()

export const LiveAdSummarySchema = AdSummarySchema.extend({
  description_excerpt: z.string(),
  occupation_label: z.string().nullable().optional(),
}).strict()

export const LiveJobSearchRequestSchema = z
  .object({
    query: z.string().min(1).max(512).optional(),
    occupation_concept_id: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    top_k: z.number().int().min(1).max(10).default(5),
  })
  .strict()

export const LiveJobSearchResponseSchema = z
  .object({
    results: z.array(LiveAdSummarySchema),
  })
  .strict()

export const LiveJobDetailsRequestSchema = z
  .object({
    ad_ids: z.array(z.string().min(1)).min(1).max(10),
  })
  .strict()

export const LiveAdDetailsErrorSchema = z
  .object({
    ad_id: z.string().min(1),
    error: z.string().min(1),
  })
  .strict()

export const LiveJobDetailsResponseSchema = z
  .object({
    results: z.array(LiveAdSummarySchema),
    errors: z.array(LiveAdDetailsErrorSchema).default([]),
  })
  .strict()

export const ConceptKindSchema = z.enum(['occupation', 'region'])

export const ConceptSchema = z
  .object({
    concept_id: z.string().min(1),
    preferred_label: z.string().min(1),
    type: ConceptKindSchema,
  })
  .strict()

export const LookupConceptRequestSchema = z
  .object({
    query: z.string().min(1).max(128),
    top_k: z.number().int().min(1).max(20).default(5),
  })
  .strict()

export const LookupConceptResponseSchema = z
  .object({
    results: z.array(ConceptSchema),
  })
  .strict()

export const EngagementEntrySchema = z
  .object({
    recorded_on: z.string(),
    status: z.string(),
    note: z.string(),
  })
  .strict()

export const EngagementStatusRequestSchema = z
  .object({
    ad_id: z.string().min(1),
  })
  .strict()

export const EngagementStatusResponseSchema = z
  .object({
    ad_id: z.string(),
    entries: z.array(EngagementEntrySchema),
  })
  .strict()

export type AdSummary = z.infer<typeof AdSummarySchema>
export type RankedAd = z.infer<typeof RankedAdSchema>
export type AdDetail = z.infer<typeof AdDetailSchema>
export type TriagedAd = z.infer<typeof TriagedAdSchema>
export type DeadlineAd = z.infer<typeof DeadlineAdSchema>
export type JobSearchRequest = z.input<typeof JobSearchRequestSchema>
export type JobSearchResponse = z.infer<typeof JobSearchResponseSchema>
export type SemanticSearchRequest = z.input<typeof SemanticSearchRequestSchema>
export type SemanticSearchResponse = z.infer<
  typeof SemanticSearchResponseSchema
>
export type JobDetailsRequest = z.input<typeof JobDetailsRequestSchema>
export type JobDetailsResponse = z.infer<typeof JobDetailsResponseSchema>
export type TriageRequest = z.input<typeof TriageRequestSchema>
export type TriageResponse = z.infer<typeof TriageResponseSchema>
export type DeadlineRequest = z.input<typeof DeadlineRequestSchema>
export type DeadlineResponse = z.infer<typeof DeadlineResponseSchema>
export type LiveAdSummary = z.infer<typeof LiveAdSummarySchema>
export type LiveJobSearchRequest = z.input<typeof LiveJobSearchRequestSchema>
export type LiveJobSearchResponse = z.infer<typeof LiveJobSearchResponseSchema>
export type LiveJobDetailsRequest = z.input<typeof LiveJobDetailsRequestSchema>
export type LiveAdDetailsError = z.infer<typeof LiveAdDetailsErrorSchema>
export type LiveJobDetailsResponse = z.infer<
  typeof LiveJobDetailsResponseSchema
>
export type Concept = z.infer<typeof ConceptSchema>
export type ConceptKind = z.infer<typeof ConceptKindSchema>
export type LookupConceptRequest = z.input<typeof LookupConceptRequestSchema>
export type LookupConceptResponse = z.infer<typeof LookupConceptResponseSchema>
export type EngagementEntry = z.infer<typeof EngagementEntrySchema>
export type EngagementStatusRequest = z.input<
  typeof EngagementStatusRequestSchema
>
export type EngagementStatusResponse = z.infer<
  typeof EngagementStatusResponseSchema
>
