'use client'

import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'

import type { CompareDiff } from '@/features/canvas/canvas-state'
import { cn } from '@/lib/utils'

export interface CompareDiffNodeData {
  readonly diffs: readonly CompareDiff[]
  readonly width: number
  readonly labelA: string
  readonly labelB: string
}

interface CompareDiffNodeRenderProps {
  readonly data: CompareDiffNodeData
}

function CompareDiffNodeComponent({ data }: CompareDiffNodeRenderProps) {
  return (
    <div
      data-slot="compare-diff-node"
      data-testid="compare-diff-node"
      className="rounded-md border bg-card/95 px-4 py-3 text-xs shadow-sm backdrop-blur"
      style={{ width: data.width }}
    >
      <div className="grid grid-cols-[6rem_1fr_1fr] gap-x-4 gap-y-2">
        <div className="text-muted-foreground">Field</div>
        <div className="font-medium text-foreground" title={data.labelA}>
          {data.labelA}
        </div>
        <div className="font-medium text-foreground" title={data.labelB}>
          {data.labelB}
        </div>
        {data.diffs.length === 0 ? (
          <div className="col-span-3 text-muted-foreground">
            No diff fields returned for this pair.
          </div>
        ) : (
          data.diffs.map((diff) => <DiffRow key={diff.field} diff={diff} />)
        )}
      </div>
    </div>
  )
}

interface DiffRowProps {
  readonly diff: CompareDiff
}

function DiffRow({ diff }: DiffRowProps) {
  const verdict = diff.verdict
  return (
    <>
      <div className="text-muted-foreground">{diff.field}</div>
      <div
        className={cn('truncate', verdictClass(verdict, 'a'))}
        title={diff.a}
      >
        {diff.a}
        {verdict === 'a' ? <VerdictBadge label="picks" /> : null}
      </div>
      <div
        className={cn('truncate', verdictClass(verdict, 'b'))}
        title={diff.b}
      >
        {diff.b}
        {verdict === 'b' ? <VerdictBadge label="picks" /> : null}
      </div>
    </>
  )
}

interface VerdictBadgeProps {
  readonly label: string
}

function VerdictBadge({ label }: VerdictBadgeProps) {
  return (
    <span className="ml-1.5 rounded-sm bg-emerald-500/15 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
      {label}
    </span>
  )
}

function verdictClass(
  verdict: CompareDiff['verdict'],
  side: 'a' | 'b',
): string {
  if (verdict === side) return 'font-semibold text-foreground'
  if (verdict === 'same') return 'text-muted-foreground'
  return 'text-foreground'
}

export const CompareDiffNode = memo(CompareDiffNodeComponent) as unknown as (
  props: NodeProps,
) => React.ReactElement
