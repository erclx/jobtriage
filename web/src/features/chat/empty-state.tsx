'use client'

import { SparklesIcon } from 'lucide-react'

import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { SEED_QUERIES } from '@/features/chat/seed-queries'

interface EmptyStateProps {
  onSelect: (query: string) => void
}

export function EmptyState({ onSelect }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <SparklesIcon className="size-5" aria-hidden />
        </div>
        <h2 className="text-lg font-medium">Ask jobtriage</h2>
        <p className="text-sm text-muted-foreground">
          Free-form chat over Swedish Platsbanken ads. Try one of these:
        </p>
      </div>
      <Suggestions>
        {SEED_QUERIES.map((query) => (
          <Suggestion
            key={query}
            suggestion={query}
            onClick={() => onSelect(query)}
          />
        ))}
      </Suggestions>
    </div>
  )
}
