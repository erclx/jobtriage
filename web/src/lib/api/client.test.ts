/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  serverEnv: {
    JOBTRIAGE_API_BASE_URL: 'http://api.test',
    JOBTRIAGE_API_TIMEOUT_MS: 5_000,
  },
}))

import { JobtriageApiError, searchJobs, semanticSearch } from './client'

const buildJsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('searchJobs', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts validated payload and parses the response', async () => {
    const fetchMock = vi.mocked(global.fetch).mockResolvedValueOnce(
      buildJsonResponse(200, {
        results: [{ ad_id: 'ad-1', headline: 'Sr Engineer' }],
      }),
    )

    const response = await searchJobs({ region: 'STH', top_k: 5 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchMock.mock.calls[0]
    expect(String(calledUrl)).toBe('http://api.test/v1/jobs/search')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      region: 'STH',
      top_k: 5,
    })
    expect(response.results).toHaveLength(1)
    expect(response.results[0].ad_id).toBe('ad-1')
  })

  it('throws JobtriageApiError on non-2xx', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      buildJsonResponse(503, { detail: 'down' }),
    )
    await expect(searchJobs({ top_k: 1 })).rejects.toBeInstanceOf(
      JobtriageApiError,
    )
  })
})

describe('semanticSearch', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses ranked results with scores', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      buildJsonResponse(200, {
        results: [
          {
            ad_id: 'ad-2',
            headline: 'AI Engineer',
            score: 0.42,
            employer_name: 'ACME',
          },
        ],
      }),
    )

    const response = await semanticSearch({ query: 'azure ml' })

    expect(response.results[0].score).toBe(0.42)
    expect(response.results[0].employer_name).toBe('ACME')
  })

  it('rejects oversized queries before calling fetch', async () => {
    const fetchMock = vi.mocked(global.fetch)
    await expect(semanticSearch({ query: 'x'.repeat(513) })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
