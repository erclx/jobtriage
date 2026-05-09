'use client'

import { LayersIcon } from 'lucide-react'

import type { AnyToolPart } from './is-tool-part'

interface SpatialSummaryProps {
  readonly part: AnyToolPart
}

export function SpatialSummary({ part }: SpatialSummaryProps) {
  if (part.state !== 'output-available') return null
  const toolName = resolveToolName(part)
  const summary = describeSpatialCall(toolName, part.input)
  if (!summary) return null
  return (
    <div className="inline-flex items-center gap-1.5 self-start rounded-md border border-dashed bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
      <LayersIcon className="size-3" aria-hidden />
      {summary}
    </div>
  )
}

function resolveToolName(part: AnyToolPart): string {
  if (part.type === 'dynamic-tool') return part.toolName
  return part.type.split('-').slice(1).join('-')
}

function describeSpatialCall(toolName: string, input: unknown): string | null {
  const data = (input ?? {}) as Record<string, unknown>
  switch (toolName) {
    case 'placeAds': {
      const count = Array.isArray(data.ad_ids) ? data.ad_ids.length : 0
      return `Placed ${count} ${pluralize('ad', count)} on the canvas`
    }
    case 'groupAds': {
      const groups = Array.isArray(data.groups) ? data.groups.length : 0
      const total = Array.isArray(data.groups)
        ? data.groups.reduce(
            (sum, group) =>
              sum +
              (Array.isArray((group as { ad_ids?: unknown[] })?.ad_ids)
                ? (group as { ad_ids: unknown[] }).ad_ids.length
                : 0),
            0,
          )
        : 0
      return `Grouped ${total} ${pluralize('ad', total)} into ${groups} ${pluralize(
        'cluster',
        groups,
      )}`
    }
    case 'connectProfileToAds': {
      const count = Array.isArray(data.links) ? data.links.length : 0
      return `Connected profile to ${count} ${pluralize('ad', count)}`
    }
    case 'pairAdsForCompare':
      return 'Paired two ads for comparison'
    case 'placeAdsOnTimeline': {
      const count = Array.isArray(data.ad_ids) ? data.ad_ids.length : 0
      return `Placed ${count} ${pluralize('ad', count)} on the timeline`
    }
    case 'pinToShortlist':
      return 'Pinned ad to shortlist'
    case 'markStatus':
      return 'Marked engagement status'
    case 'setView': {
      const view = String(data.view ?? '')
      return view ? `Switched to ${view} view` : 'Switched view'
    }
    default:
      return null
  }
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`
}
