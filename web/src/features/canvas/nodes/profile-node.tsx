'use client'

import { Handle, type NodeProps, Position } from '@xyflow/react'
import { Edit3Icon, UserRoundIcon } from 'lucide-react'
import { memo, useState } from 'react'

import { SESSION_KEYS } from '@/features/chat/storage-keys'
import { useSessionValue } from '@/features/chat/use-session-value'
import { cn } from '@/lib/utils'

const PROFILE_SUMMARY_CLAMP_LINES = 4

export interface ProfileNodeData {
  readonly onEdit: () => void
}

interface ProfileNodeRenderProps {
  readonly data: ProfileNodeData
}

function ProfileNodeComponent({ data }: ProfileNodeRenderProps) {
  const [profile] = useSessionValue(SESSION_KEYS.profile)
  const [expanded, setExpanded] = useState(false)
  const isEmpty = profile.trim().length === 0
  const summary = isEmpty ? '' : summarizeProfile(profile)
  const summaryLineCount = summary.length === 0 ? 0 : summary.split('\n').length
  const canExpand =
    !isEmpty &&
    (summaryLineCount > PROFILE_SUMMARY_CLAMP_LINES - 1 || summary.length > 140)
  const subtext = isEmpty
    ? 'Click to add criteria'
    : `${profile.length.toLocaleString()} chars · click to edit`

  function handleEditKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    data.onEdit()
  }

  function handleToggleExpand(event: React.MouseEvent) {
    event.stopPropagation()
    setExpanded((current) => !current)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={data.onEdit}
      onKeyDown={handleEditKey}
      data-slot="profile-node"
      data-testid="profile-node"
      data-empty={isEmpty || undefined}
      aria-label="Profile node"
      className="group flex w-72 flex-col gap-2 rounded-md border border-primary/40 bg-card px-3 py-2.5 text-left shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-[empty]:border-dashed data-[empty]:border-muted-foreground/40"
    >
      <Handle type="source" position={Position.Right} className="!bg-primary" />

      <header className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <UserRoundIcon className="size-3.5" aria-hidden />
          Profile
        </span>
        <Edit3Icon
          className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </header>

      {isEmpty ? (
        <p className="text-sm font-medium leading-snug">No profile yet</p>
      ) : (
        <p
          className={cn(
            'whitespace-pre-line text-xs leading-snug text-foreground/90',
            !expanded && 'line-clamp-4',
          )}
        >
          {summary}
        </p>
      )}
      {canExpand ? (
        <button
          type="button"
          onClick={handleToggleExpand}
          aria-expanded={expanded}
          data-testid="profile-node-toggle"
          className="self-start rounded-sm text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </div>
  )
}

function summarizeProfile(profile: string): string {
  const lines = profile
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.replace(/^[-*]\s+/, ''))
  return lines.slice(0, 8).join('\n')
}

export const ProfileNode = memo(ProfileNodeComponent) as unknown as (
  props: NodeProps,
) => React.ReactElement
