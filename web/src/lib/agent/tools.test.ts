/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/api/client', () => ({
  searchJobs: vi.fn(),
  semanticSearch: vi.fn(),
}))

import * as api from '@/lib/api/client'

import { jobtriageTools } from './tools'

const searchJobsMock = vi.mocked(api.searchJobs)
const semanticSearchMock = vi.mocked(api.semanticSearch)

const callOptions = {
  toolCallId: 'call-1',
  messages: [],
  abortSignal: new AbortController().signal,
} as Parameters<NonNullable<typeof jobtriageTools.searchJobs.execute>>[1]

describe('jobtriageTools.searchJobs', () => {
  afterEach(() => {
    searchJobsMock.mockReset()
    semanticSearchMock.mockReset()
  })

  it('forwards parsed input and the abort signal to the API client', async () => {
    searchJobsMock.mockResolvedValueOnce({ results: [] })
    const tool = jobtriageTools.searchJobs

    await tool.execute?.({ region: 'STH', top_k: 3 }, callOptions)

    expect(searchJobsMock).toHaveBeenCalledWith(
      { region: 'STH', top_k: 3 },
      { signal: callOptions.abortSignal },
    )
  })
})

describe('jobtriageTools.semanticSearch', () => {
  afterEach(() => {
    semanticSearchMock.mockReset()
  })

  it('forwards the query through to the semantic endpoint', async () => {
    semanticSearchMock.mockResolvedValueOnce({ results: [] })
    const tool = jobtriageTools.semanticSearch

    await tool.execute?.({ query: 'data scientist', top_k: 5 }, callOptions)

    expect(semanticSearchMock).toHaveBeenCalledWith(
      { query: 'data scientist', top_k: 5 },
      { signal: callOptions.abortSignal },
    )
  })
})
