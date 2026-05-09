import 'server-only'

import { tool } from 'ai'
import { z } from 'zod'

const AdIdsSchema = z
  .array(z.string().min(1))
  .min(1)
  .max(20)
  .describe('ad_id values from a prior data-tool result')

const PlaceAdsSchema = z
  .object({
    ad_ids: AdIdsSchema,
    layout: z
      .enum(['grid', 'stack'])
      .default('grid')
      .describe(
        'grid is the default; stack is a single column for narrow lists',
      ),
    emphasis: z
      .enum(['rrfScore', 'matchScore', 'none'])
      .default('none')
      .describe(
        'rrfScore highlights stronger retrieval ranks; matchScore highlights stronger profile fit',
      ),
  })
  .strict()

const GroupAdsSchema = z
  .object({
    groups: z
      .array(
        z
          .object({
            label: z
              .string()
              .min(1)
              .max(48)
              .describe('Short cluster label, e.g. "Strong fit"'),
            ad_ids: AdIdsSchema,
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict()

const ConnectProfileToAdsSchema = z
  .object({
    links: z
      .array(
        z
          .object({
            ad_id: z.string().min(1),
            score: z
              .number()
              .min(0)
              .max(1)
              .describe('Match score in [0, 1]; higher means stronger fit'),
            rationale: z
              .string()
              .min(1)
              .max(120)
              .describe('One short reason the profile matches'),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict()

const PairAdsForCompareSchema = z
  .object({
    ad_id_a: z.string().min(1),
    ad_id_b: z.string().min(1),
    diffs: z
      .array(
        z
          .object({
            field: z.string().min(1).max(40),
            a: z.string().max(160),
            b: z.string().max(160),
            verdict: z.enum(['same', 'a', 'b', 'neither']),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()

const PlaceAdsOnTimelineSchema = z
  .object({
    ad_ids: AdIdsSchema,
    today_cursor: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use ISO date YYYY-MM-DD')
      .describe('Today, in YYYY-MM-DD. Read the date from the system prompt.'),
  })
  .strict()

const PinToShortlistSchema = z
  .object({
    ad_id: z.string().min(1),
  })
  .strict()

const MarkStatusSchema = z
  .object({
    ad_id: z.string().min(1),
    state: z.enum(['shortlisted', 'applied', 'declined']),
    history: z
      .array(
        z
          .object({
            recorded_on: z.string(),
            status: z.string(),
            note: z.string(),
          })
          .strict(),
      )
      .max(20)
      .default([]),
  })
  .strict()

const SetViewSchema = z
  .object({
    view: z.enum(['triage', 'timeline', 'compare', 'shortlist']),
  })
  .strict()

export const spatialTools = {
  placeAds: tool({
    description:
      'Render the given ads as cards on the Triage canvas view. Call this immediately after searchJobs or semanticSearch. Pass the ad_ids in your preferred display order; the canvas resolves layout coordinates.',
    inputSchema: PlaceAdsSchema,
    execute: async (input) => ({ accepted: true, ...input }),
  }),
  groupAds: tool({
    description:
      'Render labeled clusters of ads on the Triage canvas view. Call this after triageBatch when the result naturally splits into recommendation tiers (e.g. "Strong fit", "Consider", "Pass"). Each ad_id appears in exactly one group.',
    inputSchema: GroupAdsSchema,
    execute: async (input) => ({ accepted: true, ...input }),
  }),
  connectProfileToAds: tool({
    description:
      'Draw weighted edges from the profile node to ads, with a one-line rationale per ad. Call this after matchProfile or after triageBatch when the user asked how the results match their profile.',
    inputSchema: ConnectProfileToAdsSchema,
    execute: async (input) => ({ accepted: true, ...input }),
  }),
  pairAdsForCompare: tool({
    description:
      'Switch to the Compare canvas view and place two ads side by side with a structured diff. Call this after compareRoles. Each diff names a field and the verdict ("a" if A wins, "b" if B wins, "same" if equal, "neither" if both weak).',
    inputSchema: PairAdsForCompareSchema,
    execute: async (input) => ({ accepted: true, ...input }),
  }),
  placeAdsOnTimeline: tool({
    description:
      'Switch to the Timeline canvas view and lay ads on a date axis ordered by application_deadline. Call this after deadlineWatch. The today_cursor must match the date in the system prompt.',
    inputSchema: PlaceAdsOnTimelineSchema,
    execute: async (input) => ({ accepted: true, ...input }),
  }),
  pinToShortlist: tool({
    description:
      'Add one ad to the Shortlist canvas view. Use when the user says they like an ad, want to apply, or want to keep it for later. The Shortlist persists for the browser session.',
    inputSchema: PinToShortlistSchema,
    execute: async (input) => ({ accepted: true, ...input }),
  }),
  markStatus: tool({
    description:
      'Decorate an ad on the Shortlist with engagement state from trackStatus. Call this after trackStatus returns at least one entry.',
    inputSchema: MarkStatusSchema,
    execute: async (input) => ({ accepted: true, ...input }),
  }),
  setView: tool({
    description:
      'Switch the canvas view without other mutation. Use only when the user asks to see a different view ("show me the shortlist") and no data tool fires this turn.',
    inputSchema: SetViewSchema,
    execute: async (input) => ({ accepted: true, ...input }),
  }),
} as const

export type SpatialTools = typeof spatialTools
export const SPATIAL_TOOL_NAMES = Object.keys(spatialTools) as readonly (
  | 'placeAds'
  | 'groupAds'
  | 'connectProfileToAds'
  | 'pairAdsForCompare'
  | 'placeAdsOnTimeline'
  | 'pinToShortlist'
  | 'markStatus'
  | 'setView'
)[]
