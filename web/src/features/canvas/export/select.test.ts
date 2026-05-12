import { describe, expect, it } from 'vitest'

import type { AdCardData } from '@/features/chat/ad-card-types'

import {
  type CanvasState,
  INITIAL_CANVAS_STATE,
  type MatchLink,
} from '../canvas-state'
import { selectShortlistEntries } from './select'

function ad(id: string, overrides: Partial<AdCardData> = {}): AdCardData {
  return {
    ad_id: id,
    headline: `Headline ${id}`,
    employer_name: 'Acme AB',
    municipality: 'Stockholm',
    application_deadline: '2026-06-01',
    webpage_url: `https://example.com/${id}`,
    description_excerpt: `Excerpt ${id}`,
    ...overrides,
  }
}

function stateWith(overrides: Partial<CanvasState>): CanvasState {
  return { ...INITIAL_CANVAS_STATE, ...overrides }
}

describe('selectShortlistEntries', () => {
  it('should return empty array when no ads are pinned', () => {
    const state = stateWith({ adRegistry: { a1: ad('a1') } })

    const entries = selectShortlistEntries(state)

    expect(entries).toEqual([])
  })

  it('should use the profile match rationale when one exists for the pinned ad', () => {
    const link: MatchLink = {
      adId: 'a1',
      score: 0.78,
      rationale: 'Stockholm plus Azure ML',
    }
    const state = stateWith({
      pinnedAdIds: ['a1'],
      adRegistry: { a1: ad('a1') },
      profileMatches: [link],
    })

    const [entry] = selectShortlistEntries(state)

    expect(entry?.rationale).toBe('Stockholm plus Azure ML')
  })

  it('should fall back to description_excerpt when no profile match exists', () => {
    const state = stateWith({
      pinnedAdIds: ['a1'],
      adRegistry: { a1: ad('a1', { description_excerpt: 'Snippet text' }) },
    })

    const [entry] = selectShortlistEntries(state)

    expect(entry?.rationale).toBe('Snippet text')
  })

  it('should skip pinned ids that are not in the ad registry', () => {
    const state = stateWith({
      pinnedAdIds: ['a1', 'missing'],
      adRegistry: { a1: ad('a1') },
    })

    const entries = selectShortlistEntries(state)

    expect(entries.map((entry) => entry.adId)).toEqual(['a1'])
  })

  it('should preserve pinned order', () => {
    const state = stateWith({
      pinnedAdIds: ['a2', 'a1', 'a3'],
      adRegistry: { a1: ad('a1'), a2: ad('a2'), a3: ad('a3') },
    })

    const entries = selectShortlistEntries(state)

    expect(entries.map((entry) => entry.adId)).toEqual(['a2', 'a1', 'a3'])
  })
})
