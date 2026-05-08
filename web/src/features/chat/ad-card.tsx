'use client'

import { CalendarIcon, ExternalLinkIcon } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { AdCardData, AdCardVariant } from './ad-card-types'

interface AdCardProps {
  ad: AdCardData
  variant?: AdCardVariant
}

export function AdCard({ ad, variant = 'default' }: AdCardProps) {
  const [excerptExpanded, setExcerptExpanded] = useState(false)
  const isMatched = variant === 'matched'
  const hasExcerpt = Boolean(ad.description_excerpt)

  return (
    <article
      data-testid="ad-card"
      data-variant={variant}
      className={cn(
        'flex flex-col gap-2 rounded-md border bg-background px-3 py-2.5',
        variant === 'deadline' &&
          'ring-1 ring-amber-500/30 dark:ring-amber-400/20',
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug">{ad.headline}</h3>
        {variant === 'deadline' && ad.days_until_deadline !== undefined ? (
          <Badge variant="secondary" className="gap-1">
            <CalendarIcon className="size-3" aria-hidden />
            {formatDeadlineCountdown(ad.days_until_deadline)}
          </Badge>
        ) : null}
      </header>

      <p className="text-xs text-muted-foreground">
        {[ad.employer_name, ad.municipality]
          .filter((value): value is string => Boolean(value))
          .join(' · ') || 'Unknown employer'}
        {ad.application_deadline ? (
          <>
            {' · '}
            <span data-testid="ad-card-deadline">
              Apply by {formatDate(ad.application_deadline)}
            </span>
          </>
        ) : null}
      </p>

      {hasExcerpt ? (
        <div className="flex flex-col gap-1">
          <p
            className={cn(
              'text-xs leading-relaxed text-foreground/90',
              isMatched && !excerptExpanded && 'line-clamp-4',
            )}
          >
            {ad.description_excerpt}
          </p>
          {isMatched ? (
            <button
              type="button"
              onClick={() => setExcerptExpanded((value) => !value)}
              className="w-fit rounded-sm text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-expanded={excerptExpanded}
            >
              {excerptExpanded ? 'Read less' : 'Read more'}
            </button>
          ) : null}
        </div>
      ) : null}

      {ad.webpage_url ? (
        <a
          href={ad.webpage_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Open on Platsbanken
          <ExternalLinkIcon className="size-3" aria-hidden />
        </a>
      ) : null}
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
