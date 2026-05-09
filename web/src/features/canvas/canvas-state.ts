'use client'

import { createContext, useContext } from 'react'

import type { AdCardData } from '@/features/chat/ad-card-types'
import type { EngagementStatusResponse } from '@/lib/api/schemas'

export type CanvasView = 'triage' | 'timeline' | 'compare' | 'shortlist'

export interface CanvasPosition {
  readonly x: number
  readonly y: number
}

export interface MatchLink {
  readonly adId: string
  readonly score: number
  readonly rationale: string
}

export interface AdGroup {
  readonly label: string
  readonly adIds: readonly string[]
}

export interface CompareDiff {
  readonly field: string
  readonly a: string
  readonly b: string
  readonly verdict: 'same' | 'a' | 'b' | 'neither'
}

export interface ComparePair {
  readonly adIdA: string
  readonly adIdB: string
  readonly diffs: readonly CompareDiff[]
}

export interface TimelineState {
  readonly todayCursor: string
  readonly adIds: readonly string[]
}

export type AdEmphasis = 'rrfScore' | 'matchScore' | 'none'

export interface CanvasState {
  readonly view: CanvasView
  readonly adRegistry: Readonly<Record<string, AdCardData>>
  readonly nodePositions: Readonly<Record<string, CanvasPosition>>
  readonly visibleAdIds: readonly string[]
  readonly groups: readonly AdGroup[]
  readonly emphasis: AdEmphasis
  readonly profileMatches: readonly MatchLink[]
  readonly comparePair: ComparePair | null
  readonly timeline: TimelineState | null
  readonly pinnedAdIds: readonly string[]
  readonly statuses: Readonly<Record<string, EngagementStatusResponse>>
  readonly appliedToolCallIds: readonly string[]
}

export const PROFILE_NODE_ID = '__profile__'

export const INITIAL_CANVAS_STATE: CanvasState = {
  view: 'triage',
  adRegistry: {},
  nodePositions: {},
  visibleAdIds: [],
  groups: [],
  emphasis: 'none',
  profileMatches: [],
  comparePair: null,
  timeline: null,
  pinnedAdIds: [],
  statuses: {},
  appliedToolCallIds: [],
}

export type CanvasAction =
  | {
      type: 'placeAds'
      ads: readonly AdCardData[]
      layout: 'grid' | 'stack'
      emphasis?: AdEmphasis
      toolCallId: string
    }
  | {
      type: 'groupAds'
      groups: readonly AdGroup[]
      ads: readonly AdCardData[]
      toolCallId: string
    }
  | {
      type: 'connectProfileToAds'
      links: readonly MatchLink[]
      ads: readonly AdCardData[]
      toolCallId: string
    }
  | {
      type: 'pairAdsForCompare'
      adIdA: string
      adIdB: string
      diffs: readonly CompareDiff[]
      ads: readonly AdCardData[]
      toolCallId: string
    }
  | {
      type: 'placeAdsOnTimeline'
      ads: readonly AdCardData[]
      todayCursor: string
      toolCallId: string
    }
  | { type: 'pinToShortlist'; adId: string; toolCallId: string }
  | { type: 'unpinFromShortlist'; adId: string }
  | {
      type: 'markStatus'
      adId: string
      status: EngagementStatusResponse
      toolCallId: string
    }
  | { type: 'setView'; view: CanvasView; toolCallId?: string }
  | { type: 'setNodePosition'; nodeId: string; position: CanvasPosition }
  | { type: 'hydrate'; state: CanvasState }

function ingestAds(
  registry: Readonly<Record<string, AdCardData>>,
  ads: readonly AdCardData[],
): Readonly<Record<string, AdCardData>> {
  if (ads.length === 0) return registry
  const next = { ...registry }
  for (const ad of ads) {
    next[ad.ad_id] = { ...next[ad.ad_id], ...ad }
  }
  return next
}

function uniquePush(
  list: readonly string[],
  value: string,
  cap = 100,
): readonly string[] {
  if (list.includes(value)) return list
  const next = [...list, value]
  return next.length > cap ? next.slice(next.length - cap) : next
}

export function canvasReducer(
  state: CanvasState,
  action: CanvasAction,
): CanvasState {
  if (action.type === 'hydrate') {
    return action.state
  }

  if ('toolCallId' in action && action.toolCallId) {
    if (state.appliedToolCallIds.includes(action.toolCallId)) {
      return state
    }
  }

  switch (action.type) {
    case 'placeAds': {
      const adIds = action.ads.map((ad) => ad.ad_id)
      return {
        ...state,
        view: 'triage',
        adRegistry: ingestAds(state.adRegistry, action.ads),
        visibleAdIds: adIds,
        groups: [],
        emphasis: action.emphasis ?? 'none',
        comparePair: null,
        timeline: null,
        appliedToolCallIds: uniquePush(
          state.appliedToolCallIds,
          action.toolCallId,
        ),
      }
    }

    case 'groupAds': {
      const adIds = action.groups.flatMap((group) => group.adIds)
      return {
        ...state,
        view: 'triage',
        adRegistry: ingestAds(state.adRegistry, action.ads),
        visibleAdIds: adIds,
        groups: action.groups,
        emphasis: 'none',
        comparePair: null,
        timeline: null,
        appliedToolCallIds: uniquePush(
          state.appliedToolCallIds,
          action.toolCallId,
        ),
      }
    }

    case 'connectProfileToAds': {
      const adIds = action.links.map((link) => link.adId)
      return {
        ...state,
        view: 'triage',
        adRegistry: ingestAds(state.adRegistry, action.ads),
        visibleAdIds: adIds,
        groups: [],
        emphasis: 'matchScore',
        profileMatches: action.links,
        comparePair: null,
        timeline: null,
        appliedToolCallIds: uniquePush(
          state.appliedToolCallIds,
          action.toolCallId,
        ),
      }
    }

    case 'pairAdsForCompare': {
      return {
        ...state,
        view: 'compare',
        adRegistry: ingestAds(state.adRegistry, action.ads),
        visibleAdIds: [action.adIdA, action.adIdB],
        groups: [],
        emphasis: 'none',
        comparePair: {
          adIdA: action.adIdA,
          adIdB: action.adIdB,
          diffs: action.diffs,
        },
        timeline: null,
        appliedToolCallIds: uniquePush(
          state.appliedToolCallIds,
          action.toolCallId,
        ),
      }
    }

    case 'placeAdsOnTimeline': {
      const adIds = action.ads.map((ad) => ad.ad_id)
      return {
        ...state,
        view: 'timeline',
        adRegistry: ingestAds(state.adRegistry, action.ads),
        visibleAdIds: adIds,
        groups: [],
        emphasis: 'none',
        comparePair: null,
        timeline: { todayCursor: action.todayCursor, adIds },
        appliedToolCallIds: uniquePush(
          state.appliedToolCallIds,
          action.toolCallId,
        ),
      }
    }

    case 'pinToShortlist': {
      if (state.pinnedAdIds.includes(action.adId)) {
        return {
          ...state,
          appliedToolCallIds: uniquePush(
            state.appliedToolCallIds,
            action.toolCallId,
          ),
        }
      }
      return {
        ...state,
        pinnedAdIds: [...state.pinnedAdIds, action.adId],
        appliedToolCallIds: uniquePush(
          state.appliedToolCallIds,
          action.toolCallId,
        ),
      }
    }

    case 'unpinFromShortlist': {
      if (!state.pinnedAdIds.includes(action.adId)) return state
      return {
        ...state,
        pinnedAdIds: state.pinnedAdIds.filter((id) => id !== action.adId),
      }
    }

    case 'markStatus': {
      return {
        ...state,
        statuses: { ...state.statuses, [action.adId]: action.status },
        appliedToolCallIds: uniquePush(
          state.appliedToolCallIds,
          action.toolCallId,
        ),
      }
    }

    case 'setView': {
      if (action.toolCallId) {
        return {
          ...state,
          view: action.view,
          appliedToolCallIds: uniquePush(
            state.appliedToolCallIds,
            action.toolCallId,
          ),
        }
      }
      return { ...state, view: action.view }
    }

    case 'setNodePosition': {
      return {
        ...state,
        nodePositions: {
          ...state.nodePositions,
          [action.nodeId]: action.position,
        },
      }
    }

    default:
      return state
  }
}

export interface CanvasContextValue {
  readonly state: CanvasState
  readonly dispatch: (action: CanvasAction) => void
}

export const CanvasContext = createContext<CanvasContextValue | null>(null)

export function useCanvas(): CanvasContextValue {
  const ctx = useContext(CanvasContext)
  if (!ctx) {
    throw new Error('useCanvas must be used within CanvasProvider')
  }
  return ctx
}
