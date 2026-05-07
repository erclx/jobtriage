'use client'

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import type { AnyToolPart } from '@/features/chat/is-tool-part'

interface ToolTraceProps {
  part: AnyToolPart
}

export function ToolTrace({ part }: ToolTraceProps) {
  const headerProps =
    part.type === 'dynamic-tool'
      ? { type: part.type, state: part.state, toolName: part.toolName }
      : { type: part.type, state: part.state }

  return (
    <Tool defaultOpen>
      <ToolHeader {...headerProps} />
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput
          output={part.state === 'output-available' ? part.output : undefined}
          errorText={part.state === 'output-error' ? part.errorText : undefined}
        />
      </ToolContent>
    </Tool>
  )
}
