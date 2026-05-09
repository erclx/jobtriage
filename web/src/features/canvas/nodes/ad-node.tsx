'use client'

import { Handle, type NodeProps, Position } from '@xyflow/react'
import {
  CalendarIcon,
  ExternalLinkIcon,
  PinIcon,
  PinOffIcon,
} from 'lucide-react'
import { memo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCanvas } from '@/features/canvas/canvas-state'
import { MATCH_TONE_TEXT, matchToneFor } from '@/features/canvas/match-tone'
import type { AdCardData } from '@/features/chat/ad-card-types'
import { cn } from '@/lib/utils'

export interface AdNodeData {
  readonly adId: string
}

interface AdNodeRenderProps {
  readonly data: AdNodeData
  readonly selected?: boolean
}

function AdNodeComponent({ data, selected }: AdNodeRenderProps) {
  const { state, dispatch } = useCanvas()
  const ad = state.adRegistry[data.adId] as AdCardData | undefined
  const isPinned = state.pinnedAdIds.includes(data.adId)
  const matchLink = state.profileMatches.find((link) => link.adId === data.adId)

  if (!ad) {
    return (
      <div className="rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
        Loading ad
      </div>
    )
  }

  const employerLine = [ad.employer_name, ad.municipality]
    .filter((value): value is string => Boolean(value))
    .join(' · ')

  function handlePinToggle(event: React.MouseEvent) {
    event.stopPropagation()
    if (isPinned) {
      dispatch({ type: 'unpinFromShortlist', adId: data.adId })
    } else {
      dispatch({
        type: 'pinToShortlist',
        adId: data.adId,
        toolCallId: `user-pin-${data.adId}-${Date.now()}`,
      })
    }
  }

  return (
    <article
      data-slot="ad-node"
      data-testid={`ad-node-${data.adId}`}
      className={cn(
        'flex w-72 flex-col gap-2 rounded-md border bg-card px-3 py-2.5 shadow-sm transition-shadow',
        selected && 'ring-2 ring-ring/40',
        ad.days_until_deadline !== undefined &&
          ad.days_until_deadline <= 1 &&
          'ring-1 ring-amber-500/40 dark:ring-amber-400/30',
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-border" />
      <Handle type="source" position={Position.Right} className="!bg-border" />

      <header className="flex items-baseline justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          {ad.headline}
        </h3>
        {ad.days_until_deadline !== undefined ? (
          <Badge variant="secondary" className="shrink-0 gap-1">
            <CalendarIcon className="size-3" aria-hidden />
            {formatDeadlineCountdown(ad.days_until_deadline)}
          </Badge>
        ) : null}
      </header>

      <p className="text-xs text-muted-foreground">
        {employerLine || 'Unknown employer'}
        {ad.application_deadline ? (
          <>
            {' · '}
            <span data-testid="ad-node-deadline">
              Apply by {formatDate(ad.application_deadline)}
            </span>
          </>
        ) : null}
      </p>

      {matchLink ? (
        <p className="rounded-sm bg-muted px-2 py-1 text-xs leading-relaxed text-foreground/90">
          <span
            className={cn(
              'font-semibold',
              MATCH_TONE_TEXT[matchToneFor(matchLink.score)],
            )}
          >
            {Math.round(matchLink.score * 100)}%
          </span>
          <span className="text-muted-foreground"> · </span>
          {matchLink.rationale}
        </p>
      ) : null}

      {ad.description_excerpt ? (
        <p className="line-clamp-3 text-xs leading-relaxed text-foreground/80">
          {ad.description_excerpt}
        </p>
      ) : null}

      <footer className="flex items-center justify-between gap-2 pt-0.5">
        {ad.webpage_url ? (
          <a
            href={ad.webpage_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Open on Platsbanken
            <ExternalLinkIcon className="size-3" aria-hidden />
          </a>
        ) : (
          <span aria-hidden />
        )}
        <Button
          type="button"
          variant={isPinned ? 'secondary' : 'ghost'}
          size="sm"
          onClick={handlePinToggle}
          aria-label={isPinned ? 'Unpin ad' : 'Pin ad to shortlist'}
          aria-pressed={isPinned}
        >
          {isPinned ? (
            <PinOffIcon className="size-3.5" aria-hidden />
          ) : (
            <PinIcon className="size-3.5" aria-hidden />
          )}
          {isPinned ? 'Pinned' : 'Pin'}
        </Button>
      </footer>
    </article>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDeadlineCountdown(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

export const AdNode = memo(AdNodeComponent) as unknown as (
  props: NodeProps,
) => React.ReactElement
