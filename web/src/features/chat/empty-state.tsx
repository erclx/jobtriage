'use client'

import { SparklesIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SEED_QUERIES } from '@/features/chat/seed-queries'

export interface EmptyStatePrompt {
  readonly chipLabel: string
  readonly prompt: string
}

interface EmptyStateProps {
  readonly onSelect: (query: string) => void
  readonly mode?: 'default' | 'mock'
  readonly mockPrompts?: readonly EmptyStatePrompt[]
}

export function EmptyState({
  onSelect,
  mode = 'default',
  mockPrompts = [],
}: EmptyStateProps) {
  const isMock = mode === 'mock'
  const entries = isMock
    ? mockPrompts.map((entry) => ({
        key: entry.prompt,
        label: entry.chipLabel,
        prompt: entry.prompt,
      }))
    : SEED_QUERIES.map((query) => ({ key: query, label: query, prompt: query }))

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <div className="space-y-2">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <SparklesIcon className="size-5" aria-hidden />
        </div>
        <h2 className="text-lg font-medium">
          {isMock ? 'Demo mode' : 'Ask jobtriage'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isMock
            ? 'Pick a scripted query to replay against live JobTech ads'
            : 'Free-form chat over Swedish Platsbanken ads. Try one of these:'}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {entries.map((entry) => (
          <Button
            key={entry.key}
            type="button"
            variant="outline"
            size="sm"
            className="w-full cursor-pointer justify-start truncate rounded-md px-3 text-left text-xs"
            onClick={() => onSelect(entry.prompt)}
            title={entry.prompt}
          >
            {entry.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
