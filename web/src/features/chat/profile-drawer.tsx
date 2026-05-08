'use client'

import { ChevronDownIcon, UserRoundIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { SESSION_KEYS } from '@/features/chat/storage-keys'
import { useSessionValue } from '@/features/chat/use-session-value'
import { cn } from '@/lib/utils'

interface ProfileDrawerProps {
  onProfileChange: (value: string) => void
}

const MAX_PROFILE_CHARS = 20_000

export function ProfileDrawer({ onProfileChange }: ProfileDrawerProps) {
  const [stored, setStored, clearStored] = useSessionValue(SESSION_KEYS.profile)
  const [draft, setDraft] = useState(stored)
  const [open, setOpen] = useState(false)

  const dirty = draft !== stored
  const overLimit = draft.length > MAX_PROFILE_CHARS

  function handleSave() {
    if (overLimit) return
    setStored(draft)
    onProfileChange(draft)
  }

  function handleClear() {
    setDraft('')
    clearStored()
    onProfileChange('')
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
          <span className="text-xs text-muted-foreground">
            {stored
              ? `${stored.length.toLocaleString()} chars saved`
              : 'optional, sent with each request'}
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
        <p className="text-xs text-muted-foreground">
          Paste markdown describing your role, location, must-haves, or
          deal-breakers. Forwarded with every chat turn. Held only in this
          browser tab and never persisted on the server.
        </p>
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
          <div className="flex gap-2">
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
