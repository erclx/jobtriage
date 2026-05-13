'use client'

import { CheckIcon, ChevronDownIcon, DownloadIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useCanvas } from '@/features/canvas/canvas-state'
import { cn } from '@/lib/utils'

import { toCsv } from './csv'
import { triggerDownload } from './download'
import { buildFilename, slugify } from './filename'
import { toMarkdown } from './markdown'
import { selectShortlistEntries } from './select'
import type { ShortlistEntry } from './types'

const DEFAULT_FALLBACK = 'shortlist'
const DOWNLOAD_DEBOUNCE_MS = 500
const CONFIRMATION_DURATION_MS = 2500

type Format = 'markdown' | 'csv'

interface ExportShortlistButtonProps {
  readonly demoUrl: string
  readonly className?: string
}

function defaultName(entries: readonly ShortlistEntry[]): string {
  const first = entries[0]
  if (!first) return DEFAULT_FALLBACK
  const employer = first.employer?.trim() ?? ''
  const headline = first.headline?.trim() ?? ''
  const joined = [employer, headline].filter(Boolean).join(' ')
  return slugify(joined) || DEFAULT_FALLBACK
}

function emit(
  entries: readonly ShortlistEntry[],
  format: Format,
  name: string,
  demoUrl: string,
): void {
  const today = new Date()
  if (format === 'markdown') {
    triggerDownload({
      content: toMarkdown(entries, { demoUrl }),
      mimeType: 'text/markdown',
      filename: buildFilename(name, 'md', today),
    })
    return
  }
  triggerDownload({
    content: toCsv(entries, { demoUrl }),
    mimeType: 'text/csv',
    filename: buildFilename(name, 'csv', today),
  })
}

export function ExportShortlistButton({
  demoUrl,
  className,
}: ExportShortlistButtonProps) {
  const { state } = useCanvas()
  const entries = useMemo(() => selectShortlistEntries(state), [state])
  const isDisabled = entries.length === 0

  const [open, setOpen] = useState(false)
  const [name, setName] = useState(() => defaultName(entries))
  const [seenSignature, setSeenSignature] = useState(() => entries[0]?.adId)
  const [downloaded, setDownloaded] = useState(false)
  const lastEmitAt = useRef(0)
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signature = entries[0]?.adId
  if (signature !== seenSignature) {
    setSeenSignature(signature)
    setName(defaultName(entries))
  }

  useEffect(() => {
    return () => {
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    }
  }, [])

  const markDownloaded = useCallback(() => {
    setDownloaded(true)
    if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    confirmationTimer.current = setTimeout(
      () => setDownloaded(false),
      CONFIRMATION_DURATION_MS,
    )
  }, [])

  const handleEmit = useCallback(
    (format: Format) => {
      if (entries.length === 0) return
      const now = Date.now()
      if (now - lastEmitAt.current < DOWNLOAD_DEBOUNCE_MS) return
      lastEmitAt.current = now
      emit(entries, format, name, demoUrl)
      setOpen(false)
      markDownloaded()
    },
    [entries, name, demoUrl, markDownloaded],
  )

  const handleQuickEmit = useCallback(
    (format: Format) => {
      if (entries.length === 0) return
      const now = Date.now()
      if (now - lastEmitAt.current < DOWNLOAD_DEBOUNCE_MS) return
      lastEmitAt.current = now
      emit(entries, format, defaultName(entries), demoUrl)
      markDownloaded()
    },
    [entries, demoUrl, markDownloaded],
  )

  const tooltip = isDisabled ? 'Pin an ad to enable export' : undefined

  return (
    <ButtonGroup
      className={cn('relative', className)}
      aria-label="Export shortlist"
      data-slot="export-shortlist"
    >
      <Popover open={open && !isDisabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs"
            disabled={isDisabled}
            title={tooltip}
            aria-label={
              isDisabled
                ? 'Export shortlist (pin an ad first)'
                : 'Export shortlist'
            }
          >
            <DownloadIcon aria-hidden />
            Export
            {entries.length > 0 ? (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                {entries.length}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="export-shortlist-name"
              className="text-xs font-medium text-foreground"
            >
              File name
            </label>
            <Input
              id="export-shortlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="shortlist"
              autoComplete="off"
              spellCheck={false}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Saved as <code>{buildFilename(name, 'md', new Date())}</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="flex-1 h-8 text-xs"
              onClick={() => handleEmit('markdown')}
            >
              Markdown
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="flex-1 h-8 text-xs"
              onClick={() => handleEmit('csv')}
            >
              CSV
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            disabled={isDisabled}
            aria-label="Export format options"
            title={tooltip}
          >
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onSelect={() => handleQuickEmit('markdown')}>
            Markdown (.md)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleQuickEmit('csv')}>
            CSV (.csv)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {downloaded ? (
        <span
          data-testid="export-shortlist-confirmation"
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute -bottom-7 right-0 inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[10px] font-medium text-emerald-600 shadow-sm dark:text-emerald-400"
        >
          <CheckIcon className="size-3" aria-hidden />
          Downloaded
        </span>
      ) : null}
    </ButtonGroup>
  )
}
