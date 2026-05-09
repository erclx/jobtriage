'use client'

import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'

import { cn } from '@/lib/utils'

export interface GroupNodeData {
  readonly label: string
  readonly tone: 'strong' | 'consider' | 'pass' | 'neutral'
  readonly width: number
  readonly height: number
}

const TONE_CLASS: Record<GroupNodeData['tone'], string> = {
  strong:
    'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  consider:
    'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  pass: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
  neutral: 'border-border bg-muted/30 text-foreground/80',
}

interface GroupNodeRenderProps {
  readonly data: GroupNodeData
}

function GroupNodeComponent({ data }: GroupNodeRenderProps) {
  return (
    <div
      data-slot="group-node"
      className={cn(
        'pointer-events-none rounded-lg border-2 border-dashed bg-transparent',
        TONE_CLASS[data.tone],
      )}
      style={{ width: data.width, height: data.height }}
    >
      <div className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide">
        {data.label}
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent) as unknown as (
  props: NodeProps,
) => React.ReactElement
