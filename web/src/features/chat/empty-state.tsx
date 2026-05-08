'use client'

import { SparklesIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SEED_QUERIES } from '@/features/chat/seed-queries'

interface EmptyStateProps {
  onSelect: (query: string) => void
}

export function EmptyState({ onSelect }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <SparklesIcon className="size-5" aria-hidden />
        </div>
        <h2 className="text-lg font-medium">Ask jobtriage</h2>
        <p className="text-sm text-muted-foreground">
          Free-form chat over Swedish Platsbanken ads. Try one of these:
        </p>
      </div>
      <div className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-2">
        {SEED_QUERIES.map((query) => (
          <Button
            key={query}
            type="button"
            variant="outline"
            size="sm"
            className="max-w-full cursor-pointer truncate whitespace-normal rounded-full px-4 text-left"
            onClick={() => onSelect(query)}
            title={query}
          >
            {query}
          </Button>
        ))}
      </div>
    </div>
  )
}
