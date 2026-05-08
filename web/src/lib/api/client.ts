import 'server-only'

import { serverEnv } from '@/lib/env'

import type {
  DeadlineRequest,
  DeadlineResponse,
  EngagementStatusRequest,
  EngagementStatusResponse,
  JobDetailsRequest,
  JobDetailsResponse,
  JobSearchRequest,
  JobSearchResponse,
  SemanticSearchRequest,
  SemanticSearchResponse,
  TriageRequest,
  TriageResponse,
} from './schemas'
import {
  DeadlineRequestSchema,
  DeadlineResponseSchema,
  EngagementStatusRequestSchema,
  EngagementStatusResponseSchema,
  JobDetailsRequestSchema,
  JobDetailsResponseSchema,
  JobSearchRequestSchema,
  JobSearchResponseSchema,
  SemanticSearchRequestSchema,
  SemanticSearchResponseSchema,
  TriageRequestSchema,
  TriageResponseSchema,
} from './schemas'

export class JobtriageApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'JobtriageApiError'
  }
}

interface RequestContext {
  signal?: AbortSignal
}

async function postJson<TIn, TOut>(
  path: string,
  body: TIn,
  responseSchema: { parse: (raw: unknown) => TOut },
  ctx: RequestContext,
): Promise<TOut> {
  const url = new URL(path, serverEnv.JOBTRIAGE_API_BASE_URL)
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new Error('JobtriageApi timeout')),
    serverEnv.JOBTRIAGE_API_TIMEOUT_MS,
  )
  ctx.signal?.addEventListener(
    'abort',
    () => controller.abort(ctx.signal?.reason),
    {
      once: true,
    },
  )

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new JobtriageApiError(
        `Backend ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        response.status,
      )
    }

    const raw: unknown = await response.json()
    return responseSchema.parse(raw)
  } finally {
    clearTimeout(timeout)
  }
}

export async function searchJobs(
  payload: JobSearchRequest,
  ctx: RequestContext = {},
): Promise<JobSearchResponse> {
  const body = JobSearchRequestSchema.parse(payload)
  return postJson('/v1/jobs/search', body, JobSearchResponseSchema, ctx)
}

export async function semanticSearch(
  payload: SemanticSearchRequest,
  ctx: RequestContext = {},
): Promise<SemanticSearchResponse> {
  const body = SemanticSearchRequestSchema.parse(payload)
  return postJson('/v1/jobs/semantic', body, SemanticSearchResponseSchema, ctx)
}

export async function getJobDetails(
  payload: JobDetailsRequest,
  ctx: RequestContext = {},
): Promise<JobDetailsResponse> {
  const body = JobDetailsRequestSchema.parse(payload)
  return postJson('/v1/jobs/details', body, JobDetailsResponseSchema, ctx)
}

export async function triageBatch(
  payload: TriageRequest,
  ctx: RequestContext = {},
): Promise<TriageResponse> {
  const body = TriageRequestSchema.parse(payload)
  return postJson('/v1/jobs/triage', body, TriageResponseSchema, ctx)
}

export async function deadlineWatch(
  payload: DeadlineRequest,
  ctx: RequestContext = {},
): Promise<DeadlineResponse> {
  const body = DeadlineRequestSchema.parse(payload)
  return postJson('/v1/jobs/deadline', body, DeadlineResponseSchema, ctx)
}

export async function getEngagementStatus(
  payload: EngagementStatusRequest,
  ctx: RequestContext = {},
): Promise<EngagementStatusResponse> {
  const body = EngagementStatusRequestSchema.parse(payload)
  const url = new URL(
    '/v1/engagements/status',
    serverEnv.JOBTRIAGE_API_BASE_URL,
  )
  url.searchParams.set('ad_id', body.ad_id)
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new Error('JobtriageApi timeout')),
    serverEnv.JOBTRIAGE_API_TIMEOUT_MS,
  )
  ctx.signal?.addEventListener(
    'abort',
    () => controller.abort(ctx.signal?.reason),
    { once: true },
  )
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new JobtriageApiError(
        `Backend ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        response.status,
      )
    }
    const raw: unknown = await response.json()
    return EngagementStatusResponseSchema.parse(raw)
  } finally {
    clearTimeout(timeout)
  }
}
