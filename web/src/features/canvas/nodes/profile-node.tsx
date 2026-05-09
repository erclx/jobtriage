'use client'

import { Handle, type NodeProps, Position } from '@xyflow/react'
import { Edit3Icon, UserRoundIcon } from 'lucide-react'
import { memo } from 'react'

import { SESSION_KEYS } from '@/features/chat/storage-keys'
import { useSessionValue } from '@/features/chat/use-session-value'

export interface ProfileNodeData {
  readonly onEdit: () => void
}

interface ProfileNodeRenderProps {
  readonly data: ProfileNodeData
}

function ProfileNodeComponent({ data }: ProfileNodeRenderProps) {
  const [profile] = useSessionValue(SESSION_KEYS.profile)
  const isEmpty = profile.trim().length === 0
  const summary = isEmpty ? '' : summarizeProfile(profile)
  const subtext = isEmpty
    ? 'Click to add criteria'
    : `${profile.length.toLocaleString()} chars · click to edit`

  return (
    <button
      type="button"
      onClick={data.onEdit}
      onDoubleClick={data.onEdit}
      data-slot="profile-node"
      data-testid="profile-node"
      data-empty={isEmpty || undefined}
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
        <p className="line-clamp-4 whitespace-pre-line text-xs leading-snug text-foreground/90">
          {summary}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </button>
  )
}

function summarizeProfile(profile: string): string {
  const lines = profile
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.replace(/^[-*]\s+/, ''))
  return lines.slice(0, 4).join('\n')
}

export const ProfileNode = memo(ProfileNodeComponent) as unknown as (
  props: NodeProps,
) => React.ReactElement
