import { describe, expect, it } from 'vitest'

import {
  canvasReducer,
  type CanvasState,
  INITIAL_CANVAS_STATE,
} from './canvas-state'

const adFixture = (overrides: { ad_id: string }) => ({
  ad_id: overrides.ad_id,
  headline: `Headline ${overrides.ad_id}`,
  employer_name: 'Acme AB',
  municipality: 'Stockholm',
  application_deadline: '2026-06-01',
  webpage_url: `https://example.com/${overrides.ad_id}`,
})

describe('canvasReducer', () => {
  it('should set view and visible ads when placeAds dispatches', () => {
    const state = canvasReducer(INITIAL_CANVAS_STATE, {
      type: 'placeAds',
      ads: [adFixture({ ad_id: 'a1' }), adFixture({ ad_id: 'a2' })],
      layout: 'grid',
      toolCallId: 'call-1',
    })

    expect(state.view).toBe('triage')
    expect(state.visibleAdIds).toEqual(['a1', 'a2'])
    expect(state.adRegistry.a1.headline).toBe('Headline a1')
    expect(state.appliedToolCallIds).toContain('call-1')
  })

  it('should ignore a toolCallId already applied', () => {
    const first = canvasReducer(INITIAL_CANVAS_STATE, {
      type: 'placeAds',
      ads: [adFixture({ ad_id: 'a1' })],
      layout: 'grid',
      toolCallId: 'call-1',
    })

    const second = canvasReducer(first, {
      type: 'placeAds',
      ads: [adFixture({ ad_id: 'a2' })],
      layout: 'grid',
      toolCallId: 'call-1',
    })

    expect(second).toBe(first)
  })

  it('should switch to compare view and capture diffs on pairAdsForCompare', () => {
    const state = canvasReducer(INITIAL_CANVAS_STATE, {
      type: 'pairAdsForCompare',
      adIdA: 'a1',
      adIdB: 'a2',
      diffs: [
        { field: 'location', a: 'Stockholm', b: 'Göteborg', verdict: 'a' },
      ],
      ads: [adFixture({ ad_id: 'a1' }), adFixture({ ad_id: 'a2' })],
      toolCallId: 'call-cmp',
    })

    expect(state.view).toBe('compare')
    expect(state.comparePair?.adIdA).toBe('a1')
    expect(state.comparePair?.diffs[0].verdict).toBe('a')
  })

  it('should record profile-to-ad edges with rationale on connectProfileToAds', () => {
    const state = canvasReducer(INITIAL_CANVAS_STATE, {
      type: 'connectProfileToAds',
      links: [{ adId: 'a1', score: 0.8, rationale: 'Stockholm + Azure ML' }],
      ads: [adFixture({ ad_id: 'a1' })],
      toolCallId: 'call-match',
    })

    expect(state.emphasis).toBe('matchScore')
    expect(state.profileMatches[0].score).toBe(0.8)
  })

  it('should toggle pinned ad ids without duplicates', () => {
    const pinned = canvasReducer(INITIAL_CANVAS_STATE, {
      type: 'pinToShortlist',
      adId: 'a1',
      toolCallId: 'pin-1',
    })
    expect(pinned.pinnedAdIds).toEqual(['a1'])

    const repinned = canvasReducer(pinned, {
      type: 'pinToShortlist',
      adId: 'a1',
      toolCallId: 'pin-2',
    })
    expect(repinned.pinnedAdIds).toEqual(['a1'])

    const unpinned = canvasReducer(repinned, {
      type: 'unpinFromShortlist',
      adId: 'a1',
    })
    expect(unpinned.pinnedAdIds).toEqual([])
  })

  it('should persist node positions via setNodePosition', () => {
    const state = canvasReducer(INITIAL_CANVAS_STATE, {
      type: 'setNodePosition',
      nodeId: 'a1',
      position: { x: 200, y: 80 },
    })

    expect(state.nodePositions.a1).toEqual({ x: 200, y: 80 })
  })

  it('should hydrate the full state in one shot', () => {
    const next: CanvasState = {
      ...INITIAL_CANVAS_STATE,
      view: 'shortlist',
      pinnedAdIds: ['a9'],
    }

    const state = canvasReducer(INITIAL_CANVAS_STATE, {
      type: 'hydrate',
      state: next,
    })

    expect(state).toEqual(next)
  })
})
