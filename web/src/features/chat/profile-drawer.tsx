'use client'

import { CheckIcon, ChevronDownIcon, UserRoundIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { SESSION_KEYS } from '@/features/chat/storage-keys'
import { useSessionValue } from '@/features/chat/use-session-value'
import { EXAMPLE_PROFILE } from '@/lib/agent/example-profile'
import { cn } from '@/lib/utils'

interface ProfileDrawerProps {
  onProfileChange: (value: string) => void
}

const MAX_PROFILE_CHARS = 20_000

export function ProfileDrawer({ onProfileChange }: ProfileDrawerProps) {
  const [stored, setStored, clearStored] = useSessionValue(SESSION_KEYS.profile)
  const [draft, setDraft] = useState(stored)
  const [open, setOpen] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = draft !== stored
  const overLimit = draft.length > MAX_PROFILE_CHARS
  const headerHint = headerHintFor(stored, draft, dirty)

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [])

  function handleSave() {
    if (overLimit) return
    setStored(draft)
    onProfileChange(draft)
    setJustSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setJustSaved(false), 2500)
  }

  function handleClear() {
    setDraft('')
    clearStored()
    onProfileChange('')
  }

  function handleLoadExample() {
    setDraft(EXAMPLE_PROFILE)
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-md border bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm">
        <div className="flex items-center gap-2">
          <UserRoundIcon className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-medium">Profile</span>
          <span
            className={cn(
              'text-xs',
              dirty
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground',
            )}
          >
            {headerHint}
          </span>
        </div>
        <ChevronDownIcon
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Paste markdown describing your role, location, must-haves, or
            deal-breakers. Forwarded with every chat turn. Held only in this
            browser tab and never persisted on the server.
          </p>
          {draft.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadExample}
            >
              Load example
            </Button>
          ) : null}
        </div>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="## Role&#10;Senior AI engineer&#10;## Must-haves&#10;..."
          rows={8}
          aria-invalid={overLimit ? 'true' : 'false'}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-xs',
              overLimit ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {draft.length.toLocaleString()} /{' '}
            {MAX_PROFILE_CHARS.toLocaleString()} chars
          </span>
          <div className="flex items-center gap-2">
            {dirty && !overLimit ? (
              <span
                className="text-xs text-amber-600 dark:text-amber-400"
                aria-live="polite"
              >
                Unsaved changes
              </span>
            ) : justSaved ? (
              <span
                className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                role="status"
                aria-live="polite"
              >
                <CheckIcon className="size-3.5" aria-hidden />
                Saved
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={!stored && !draft}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!dirty || overLimit}
            >
              Save
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function headerHintFor(stored: string, draft: string, dirty: boolean): string {
  if (dirty) {
    const draftCount = draft.length.toLocaleString()
    if (stored) {
      return `${stored.length.toLocaleString()} chars saved, ${draftCount} unsaved`
    }
    return `${draftCount} chars unsaved`
  }
  if (stored) {
    return `${stored.length.toLocaleString()} chars saved`
  }
  return 'optional, sent with each request'
}
