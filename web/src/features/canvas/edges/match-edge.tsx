'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react'
import { memo } from 'react'

import {
  MATCH_TONE_BORDER,
  MATCH_TONE_TEXT,
  matchToneFor,
} from '@/features/canvas/match-tone'
import { cn } from '@/lib/utils'

export interface MatchEdgeData {
  readonly score: number
  readonly rationale: string
}

interface MatchEdgeRenderProps {
  readonly id: string
  readonly sourceX: number
  readonly sourceY: number
  readonly targetX: number
  readonly targetY: number
  readonly sourcePosition: EdgeProps['sourcePosition']
  readonly targetPosition: EdgeProps['targetPosition']
  readonly data?: MatchEdgeData
}

function MatchEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: MatchEdgeRenderProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const score = data?.score ?? 0
  const strokeWidth = 1 + score * 2.5
  const opacity = 0.35 + score * 0.5

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: 'var(--primary)',
          strokeWidth,
          strokeOpacity: opacity,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'none',
          }}
          className={cn(
            'rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold shadow-sm',
            MATCH_TONE_BORDER[matchToneFor(score)],
            MATCH_TONE_TEXT[matchToneFor(score)],
          )}
        >
          {Math.round(score * 100)}%
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const MatchEdge = memo(MatchEdgeComponent) as unknown as (
  props: EdgeProps,
) => React.ReactElement
