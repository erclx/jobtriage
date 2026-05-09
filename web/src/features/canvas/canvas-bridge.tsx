'use client'

import type { UIMessage } from 'ai'
import { useEffect, useRef } from 'react'

import {
  type CanvasAction,
  type CanvasView,
  type CompareDiff,
  type MatchLink,
  useCanvas,
} from '@/features/canvas/canvas-state'
import type { AdCardData } from '@/features/chat/ad-card-types'

interface CanvasBridgeProps {
  readonly messages: readonly UIMessage[]
}

interface ToolPartLike {
  readonly type: string
  readonly state?: string
  readonly toolCallId?: string
  readonly toolName?: string
  readonly input?: unknown
  readonly output?: unknown
}

const SPATIAL_TOOLS = new Set([
  'placeAds',
  'groupAds',
  'connectProfileToAds',
  'pairAdsForCompare',
  'placeAdsOnTimeline',
  'pinToShortlist',
  'markStatus',
  'setView',
])

const DATA_TOOLS = new Set([
  'searchJobs',
  'semanticSearch',
  'triageBatch',
  'matchProfile',
  'compareRoles',
  'deadlineWatch',
  'trackStatus',
])

export function CanvasBridge({ messages }: CanvasBridgeProps) {
  const { dispatch } = useCanvas()
  const registry = useRef(new Map<string, AdCardData>())

  useEffect(() => {
    const actions: CanvasAction[] = []
    const local = registry.current

    for (const message of messages) {
      for (const part of message.parts as readonly ToolPartLike[]) {
        if (!isToolPart(part)) continue
        if (part.state !== 'output-available') continue

        const toolName = resolveToolName(part)
        if (!toolName) continue

        if (DATA_TOOLS.has(toolName)) {
          ingestAds(local, part.output)
          continue
        }

        if (!SPATIAL_TOOLS.has(toolName)) continue
        const action = toCanvasAction(toolName, part, local)
        if (action) actions.push(action)
      }
    }

    for (const action of actions) {
      dispatch(action)
    }
  }, [messages, dispatch])

  return null
}

function isToolPart(part: ToolPartLike): boolean {
  return part.type.startsWith('tool-') || part.type === 'dynamic-tool'
}

function resolveToolName(part: ToolPartLike): string | null {
  if (part.type === 'dynamic-tool' && part.toolName) return part.toolName
  if (!part.type.startsWith('tool-')) return null
  return part.type.slice('tool-'.length)
}

function ingestAds(registry: Map<string, AdCardData>, output: unknown): void {
  if (!output || typeof output !== 'object') return
  const results = (output as { results?: unknown }).results
  if (!Array.isArray(results)) return
  for (const entry of results) {
    if (!entry || typeof entry !== 'object') continue
    const ad = entry as AdCardData
    if (typeof ad.ad_id !== 'string') continue
    const previous = registry.get(ad.ad_id)
    registry.set(ad.ad_id, { ...previous, ...ad })
  }
}

function resolveAds(
  registry: Map<string, AdCardData>,
  adIds: readonly string[],
): readonly AdCardData[] {
  const ads: AdCardData[] = []
  for (const id of adIds) {
    const ad = registry.get(id)
    if (ad) ads.push(ad)
  }
  return ads
}

function toCanvasAction(
  toolName: string,
  part: ToolPartLike,
  registry: Map<string, AdCardData>,
): CanvasAction | null {
  const toolCallId = part.toolCallId
  if (!toolCallId) return null
  const input = (part.input ?? {}) as Record<string, unknown>

  switch (toolName) {
    case 'placeAds': {
      const adIds = readStringArray(input.ad_ids)
      if (adIds.length === 0) return null
      const layout = (input.layout as 'grid' | 'stack') ?? 'grid'
      const emphasis =
        (input.emphasis as 'rrfScore' | 'matchScore' | 'none') ?? 'none'
      return {
        type: 'placeAds',
        ads: resolveAds(registry, adIds),
        layout,
        emphasis,
        toolCallId,
      }
    }

    case 'groupAds': {
      const groupsRaw = Array.isArray(input.groups) ? input.groups : []
      const groups = groupsRaw
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const label = String(
            (entry as { label?: unknown }).label ?? '',
          ).trim()
          const adIds = readStringArray((entry as { ad_ids?: unknown }).ad_ids)
          if (!label || adIds.length === 0) return null
          return { label, adIds }
        })
        .filter(
          (entry): entry is { label: string; adIds: string[] } =>
            entry !== null,
        )
      if (groups.length === 0) return null
      const allIds = groups.flatMap((group) => group.adIds)
      return {
        type: 'groupAds',
        groups,
        ads: resolveAds(registry, allIds),
        toolCallId,
      }
    }

    case 'connectProfileToAds': {
      const linksRaw = Array.isArray(input.links) ? input.links : []
      const links: MatchLink[] = linksRaw
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const adId = String((entry as { ad_id?: unknown }).ad_id ?? '').trim()
          const score = Number((entry as { score?: unknown }).score ?? 0)
          const rationale = String(
            (entry as { rationale?: unknown }).rationale ?? '',
          )
          if (!adId || Number.isNaN(score)) return null
          return { adId, score, rationale }
        })
        .filter((entry): entry is MatchLink => entry !== null)
      if (links.length === 0) return null
      return {
        type: 'connectProfileToAds',
        links,
        ads: resolveAds(
          registry,
          links.map((link) => link.adId),
        ),
        toolCallId,
      }
    }

    case 'pairAdsForCompare': {
      const adIdA = String(input.ad_id_a ?? '').trim()
      const adIdB = String(input.ad_id_b ?? '').trim()
      if (!adIdA || !adIdB) return null
      const diffsRaw = Array.isArray(input.diffs) ? input.diffs : []
      const diffs: CompareDiff[] = diffsRaw
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const field = String((entry as { field?: unknown }).field ?? '')
          if (!field) return null
          const a = String((entry as { a?: unknown }).a ?? '')
          const b = String((entry as { b?: unknown }).b ?? '')
          const verdictRaw = String(
            (entry as { verdict?: unknown }).verdict ?? 'same',
          )
          const verdict: CompareDiff['verdict'] =
            verdictRaw === 'a' || verdictRaw === 'b' || verdictRaw === 'neither'
              ? verdictRaw
              : 'same'
          return { field, a, b, verdict }
        })
        .filter((entry): entry is CompareDiff => entry !== null)
      return {
        type: 'pairAdsForCompare',
        adIdA,
        adIdB,
        diffs,
        ads: resolveAds(registry, [adIdA, adIdB]),
        toolCallId,
      }
    }

    case 'placeAdsOnTimeline': {
      const adIds = readStringArray(input.ad_ids)
      const todayCursor = String(input.today_cursor ?? '').trim()
      if (adIds.length === 0 || !todayCursor) return null
      return {
        type: 'placeAdsOnTimeline',
        ads: resolveAds(registry, adIds),
        todayCursor,
        toolCallId,
      }
    }

    case 'pinToShortlist': {
      const adId = String(input.ad_id ?? '').trim()
      if (!adId) return null
      return { type: 'pinToShortlist', adId, toolCallId }
    }

    case 'markStatus': {
      const adId = String(input.ad_id ?? '').trim()
      if (!adId) return null
      const historyRaw = Array.isArray(input.history) ? input.history : []
      return {
        type: 'markStatus',
        adId,
        status: {
          ad_id: adId,
          entries: historyRaw.filter(
            (
              entry,
            ): entry is { recorded_on: string; status: string; note: string } =>
              Boolean(entry && typeof entry === 'object'),
          ),
        },
        toolCallId,
      }
    }

    case 'setView': {
      const view = String(input.view ?? '').trim() as CanvasView
      const allowed: readonly CanvasView[] = [
        'triage',
        'timeline',
        'compare',
        'shortlist',
      ]
      if (!allowed.includes(view)) return null
      return { type: 'setView', view, toolCallId }
    }

    default:
      return null
  }
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
}
