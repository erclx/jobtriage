'use client'

import { CheckIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  clearProfileSource,
  SESSION_KEYS,
  writeProfileSource,
} from '@/features/chat/storage-keys'
import { useSessionValue } from '@/features/chat/use-session-value'
import { EXAMPLE_PROFILE } from '@/lib/agent/example-profile'
import { cn } from '@/lib/utils'

interface ProfileDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onProfileChange: (value: string) => void
}

const MAX_PROFILE_CHARS = 20_000

export function ProfileDialog({
  open,
  onOpenChange,
  onProfileChange,
}: ProfileDialogProps) {
  const [stored, setStored, clearStored] = useSessionValue(SESSION_KEYS.profile)
  const [draft, setDraft] = useState(stored)
  const [seenStored, setSeenStored] = useState(stored)
  const [seenOpen, setSeenOpen] = useState(open)
  const [justSaved, setJustSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (open && !seenOpen) {
    setSeenOpen(true)
    setDraft(stored)
    setSeenStored(stored)
  } else if (!open && seenOpen) {
    setSeenOpen(false)
  }

  if (open && seenStored !== stored) {
    setSeenStored(stored)
  }

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [])

  const dirty = draft !== stored
  const overLimit = draft.length > MAX_PROFILE_CHARS

  const persist = useCallback(
    (value: string) => {
      setStored(value)
      if (value.trim().length === 0) {
        clearProfileSource()
      } else {
        writeProfileSource('user')
      }
      onProfileChange(value)
    },
    [setStored, onProfileChange],
  )

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && draft !== stored) {
        persist(draft)
      }
      onOpenChange(next)
    },
    [draft, stored, persist, onOpenChange],
  )

  function handleSave() {
    persist(draft)
    setJustSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setJustSaved(false), 2500)
  }

  function handleClear() {
    setDraft('')
    clearStored()
    clearProfileSource()
    onProfileChange('')
  }

  function handleLoadExample() {
    setDraft(EXAMPLE_PROFILE)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[min(92vw,960px)] flex-col gap-4 sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>
            Paste markdown describing your role, location, must-haves, or
            deal-breakers. Forwarded with every chat turn. Held only in this
            browser tab and never persisted on the server. Closing the dialog
            saves any pending edits.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-end">
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
            className="min-h-[55vh] flex-1 resize-none font-mono text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'text-xs',
                overLimit
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground',
              )}
              aria-live="polite"
            >
              {draft.length.toLocaleString()} /{' '}
              {MAX_PROFILE_CHARS.toLocaleString()} chars
              {overLimit ? ' (over soft cap)' : ''}
            </span>
            <div className="flex items-center gap-2">
              {dirty ? (
                <span
                  className="text-xs text-amber-600 dark:text-amber-400"
                  aria-live="polite"
                >
                  Unsaved changes, will save on close
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
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={!stored && !draft}
          >
            Clear
          </Button>
          <Button type="button" onClick={handleSave} disabled={!dirty}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
