/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/api/client', () => ({
  searchJobs: vi.fn(),
  semanticSearch: vi.fn(),
  getJobDetails: vi.fn(),
  triageBatch: vi.fn(),
  deadlineWatch: vi.fn(),
  getEngagementStatus: vi.fn(),
  lookupConcept: vi.fn(),
  liveSearchJobs: vi.fn(),
  liveGetJobDetails: vi.fn(),
}))

import * as api from '@/lib/api/client'
import { TriageRequestSchema } from '@/lib/api/schemas'

import { deployJobtriageTools, jobtriageTools } from './tools'

const searchJobsMock = vi.mocked(api.searchJobs)
const semanticSearchMock = vi.mocked(api.semanticSearch)
const getJobDetailsMock = vi.mocked(api.getJobDetails)
const triageBatchMock = vi.mocked(api.triageBatch)
const deadlineWatchMock = vi.mocked(api.deadlineWatch)
const getEngagementStatusMock = vi.mocked(api.getEngagementStatus)

const callOptions = {
  toolCallId: 'call-1',
  messages: [],
  abortSignal: new AbortController().signal,
} as Parameters<NonNullable<typeof jobtriageTools.searchJobs.execute>>[1]

afterEach(() => {
  searchJobsMock.mockReset()
  semanticSearchMock.mockReset()
  getJobDetailsMock.mockReset()
  triageBatchMock.mockReset()
  deadlineWatchMock.mockReset()
  getEngagementStatusMock.mockReset()
})

describe('jobtriageTools.searchJobs', () => {
  it('forwards parsed input and the abort signal to the API client', async () => {
    searchJobsMock.mockResolvedValueOnce({ results: [] })

    await jobtriageTools.searchJobs.execute?.(
      { region: 'STH', top_k: 3 },
      callOptions,
    )

    expect(searchJobsMock).toHaveBeenCalledWith(
      { region: 'STH', top_k: 3 },
      { signal: callOptions.abortSignal },
    )
  })
})

describe('jobtriageTools.semanticSearch', () => {
  it('forwards the query through to the semantic endpoint', async () => {
    semanticSearchMock.mockResolvedValueOnce({ results: [] })

    await jobtriageTools.semanticSearch.execute?.(
      { query: 'data scientist', top_k: 5 },
      callOptions,
    )

    expect(semanticSearchMock).toHaveBeenCalledWith(
      { query: 'data scientist', top_k: 5 },
      { signal: callOptions.abortSignal },
    )
  })
})

describe('jobtriageTools.matchProfile', () => {
  it('forwards a single ad_id to /v1/jobs/details', async () => {
    getJobDetailsMock.mockResolvedValueOnce({ results: [] })

    await jobtriageTools.matchProfile.execute?.(
      { ad_ids: ['ad-1'] },
      callOptions,
    )

    expect(getJobDetailsMock).toHaveBeenCalledWith(
      { ad_ids: ['ad-1'] },
      { signal: callOptions.abortSignal },
    )
  })
})

describe('jobtriageTools.triageBatch', () => {
  it('caps top_k to 10 via the schema', () => {
    const parsed = TriageRequestSchema.safeParse({
      query: 'agents',
      top_k: 99,
    })

    expect(parsed.success).toBe(false)
  })

  it('forwards the query to the triage endpoint', async () => {
    triageBatchMock.mockResolvedValueOnce({ results: [] })

    await jobtriageTools.triageBatch.execute?.(
      { query: 'agents', top_k: 5 },
      callOptions,
    )

    expect(triageBatchMock).toHaveBeenCalledWith(
      { query: 'agents', top_k: 5 },
      { signal: callOptions.abortSignal },
    )
  })
})

describe('jobtriageTools.compareRoles', () => {
  it('forwards multiple ad_ids to /v1/jobs/details', async () => {
    getJobDetailsMock.mockResolvedValueOnce({ results: [] })

    await jobtriageTools.compareRoles.execute?.(
      { ad_ids: ['ad-1', 'ad-2'] },
      callOptions,
    )

    expect(getJobDetailsMock).toHaveBeenCalledWith(
      { ad_ids: ['ad-1', 'ad-2'] },
      { signal: callOptions.abortSignal },
    )
  })
})

describe('jobtriageTools.deadlineWatch', () => {
  it('forwards a window to the deadline endpoint', async () => {
    deadlineWatchMock.mockResolvedValueOnce({ results: [] })

    await jobtriageTools.deadlineWatch.execute?.(
      { window_days: 14, top_k: 10 },
      callOptions,
    )

    expect(deadlineWatchMock).toHaveBeenCalledWith(
      { window_days: 14, top_k: 10 },
      { signal: callOptions.abortSignal },
    )
  })
})

describe('deployJobtriageTools.lookupConcept', () => {
  it('should forward query and top_k to the taxonomy endpoint', async () => {
    const lookupMock = vi.mocked(api.lookupConcept)
    lookupMock.mockResolvedValueOnce({ results: [] })

    await deployJobtriageTools.lookupConcept.execute?.(
      { query: 'nurse', top_k: 5 },
      callOptions,
    )

    expect(lookupMock).toHaveBeenCalledWith(
      { query: 'nurse', top_k: 5 },
      { signal: callOptions.abortSignal },
    )
  })
})

describe('deployJobtriageTools.searchJobs', () => {
  it('should forward to the live JobTech endpoint', async () => {
    const liveMock = vi.mocked(api.liveSearchJobs)
    liveMock.mockResolvedValueOnce({ results: [] })

    await deployJobtriageTools.searchJobs.execute?.(
      { query: 'nurse', region: 'AvNB_uwa_6n6', top_k: 5 },
      callOptions,
    )

    expect(liveMock).toHaveBeenCalledWith(
      { query: 'nurse', region: 'AvNB_uwa_6n6', top_k: 5 },
      { signal: callOptions.abortSignal },
    )
  })
})

describe('jobtriageTools.trackStatus', () => {
  it('forwards an ad_id to the engagement endpoint', async () => {
    getEngagementStatusMock.mockResolvedValueOnce({
      ad_id: 'ad-1',
      entries: [],
    })

    await jobtriageTools.trackStatus.execute?.({ ad_id: 'ad-1' }, callOptions)

    expect(getEngagementStatusMock).toHaveBeenCalledWith(
      { ad_id: 'ad-1' },
      { signal: callOptions.abortSignal },
    )
  })
})
