'use client'

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import type { EngagementStatusResponse } from '@/lib/api/schemas'

import { EngagementStatusCard } from './engagement-status'
import type { AnyToolPart } from './is-tool-part'

interface ToolTraceProps {
  readonly part: AnyToolPart
}

const TOOL_LABEL: Record<string, string> = {
  searchJobs: 'Searched JobTech filter',
  semanticSearch: 'Hybrid retrieval',
  matchProfile: 'Matched profile to ad',
  triageBatch: 'Triaged batch',
  compareRoles: 'Compared roles',
  deadlineWatch: 'Deadline watch',
  trackStatus: 'Engagement status',
}

export function ToolTrace({ part }: ToolTraceProps) {
  const headerProps =
    part.type === 'dynamic-tool'
      ? { type: part.type, state: part.state, toolName: part.toolName }
      : { type: part.type, state: part.state }

  const toolName = resolveToolName(part)

  return (
    <div className="flex flex-col gap-2">
      {toolName === 'trackStatus' && part.state === 'output-available' ? (
        <EngagementStatusCard
          status={part.output as EngagementStatusResponse}
        />
      ) : null}
      {part.state === 'output-error' ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {part.errorText ?? 'Tool failed.'}
        </div>
      ) : null}
      <Tool defaultOpen={false}>
        <ToolHeader
          title={TOOL_LABEL[toolName] ?? toolName}
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          {...headerProps}
        />
        <ToolContent>
          {part.state !== 'input-streaming' && <ToolInput input={part.input} />}
          <ToolOutput
            output={part.state === 'output-available' ? part.output : undefined}
            errorText={
              part.state === 'output-error' ? part.errorText : undefined
            }
          />
        </ToolContent>
      </Tool>
    </div>
  )
}

function resolveToolName(part: AnyToolPart): string {
  if (part.type === 'dynamic-tool') return part.toolName
  return part.type.split('-').slice(1).join('-')
}
