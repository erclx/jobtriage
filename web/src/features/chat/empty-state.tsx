'use client'

import { SparklesIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SEED_QUERIES } from '@/features/chat/seed-queries'

interface EmptyStateProps {
  onSelect: (query: string) => void
}

export function EmptyState({ onSelect }: EmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <div className="space-y-2">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <SparklesIcon className="size-5" aria-hidden />
        </div>
        <h2 className="text-lg font-medium">Ask jobtriage</h2>
        <p className="text-sm text-muted-foreground">
          Free-form chat over Swedish Platsbanken ads. Try one of these:
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {SEED_QUERIES.map((query) => (
          <Button
            key={query}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto w-full cursor-pointer justify-start whitespace-normal rounded-md px-3 py-2 text-left text-xs leading-snug"
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
