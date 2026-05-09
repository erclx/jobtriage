'use client'

import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react'
import { memo } from 'react'

import { MATCH_TONE_STROKE, matchToneFor } from '@/features/canvas/match-tone'

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
  const [path] = getBezierPath({
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
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: MATCH_TONE_STROKE[matchToneFor(score)],
        strokeWidth,
        strokeOpacity: opacity,
      }}
    />
  )
}

export const MatchEdge = memo(MatchEdgeComponent) as unknown as (
  props: EdgeProps,
) => React.ReactElement
