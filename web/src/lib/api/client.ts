import 'server-only'

import { serverEnv } from '@/lib/env'

import type {
  JobSearchRequest,
  JobSearchResponse,
  SemanticSearchRequest,
  SemanticSearchResponse,
} from './schemas'
import {
  JobSearchRequestSchema,
  JobSearchResponseSchema,
  SemanticSearchRequestSchema,
  SemanticSearchResponseSchema,
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
