'use client'

import { Spinner } from '@/components/ui/spinner'

import { AdCard } from './ad-card'
import type { AdCardData, AdCardVariant } from './ad-card-types'

interface AdCardListProps {
  ads: readonly AdCardData[]
  variant?: AdCardVariant
  state: 'loading' | 'empty' | 'error' | 'ready'
  emptyCopy: string
  errorMessage?: string
}

export function AdCardList({
  ads,
  variant = 'default',
  state,
  emptyCopy,
  errorMessage,
}: AdCardListProps) {
  if (state === 'loading') {
    return (
      <div
        aria-live="polite"
        data-testid="ad-card-loading"
        className="flex items-center gap-2 rounded-md border border-dashed bg-background px-3 py-3 text-xs text-muted-foreground"
      >
        <Spinner className="size-3" />
        Loading ads
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        {errorMessage ?? 'Tool failed. Try the request again.'}
      </div>
    )
  }

  if (state === 'empty' || ads.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
        {emptyCopy}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {ads.map((ad) => (
        <AdCard key={ad.ad_id} ad={ad} variant={variant} />
      ))}
    </div>
  )
}
