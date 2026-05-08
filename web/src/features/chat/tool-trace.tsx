'use client'

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import type {
  AdSummary,
  DeadlineAd,
  EngagementStatusResponse,
  RankedAd,
  TriagedAd,
} from '@/lib/api/schemas'

import { AdCardList } from './ad-card-list'
import type { AdCardData, AdCardVariant } from './ad-card-types'
import { EngagementStatusCard } from './engagement-status'
import type { AnyToolPart } from './is-tool-part'

interface ToolTraceProps {
  part: AnyToolPart
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
      {part.state === 'output-available' ? (
        <ToolResultRender toolName={toolName} output={part.output} />
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
        <ToolHeader title={TOOL_LABEL[toolName]} {...headerProps} />
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

interface ToolResultRenderProps {
  toolName: string
  output: unknown
}

function ToolResultRender({ toolName, output }: ToolResultRenderProps) {
  if (toolName === 'trackStatus') {
    const status = output as EngagementStatusResponse | undefined
    if (!status) return null
    return <EngagementStatusCard status={status} />
  }

  const ads = extractAds(output)
  if (ads === null) return null

  const variant = adCardVariant(toolName)
  const emptyCopy = emptyCopyFor(toolName)

  return (
    <AdCardList
      ads={ads}
      variant={variant}
      state={ads.length === 0 ? 'empty' : 'ready'}
      emptyCopy={emptyCopy}
    />
  )
}

function extractAds(output: unknown): readonly AdCardData[] | null {
  if (!output || typeof output !== 'object' || !('results' in output)) {
    return null
  }
  const results = (output as { results: unknown }).results
  if (!Array.isArray(results)) return null
  return results as readonly (AdSummary | RankedAd | TriagedAd | DeadlineAd)[]
}

function adCardVariant(toolName: string): AdCardVariant {
  if (toolName === 'deadlineWatch') return 'deadline'
  if (toolName === 'matchProfile' || toolName === 'compareRoles') {
    return 'matched'
  }
  return 'default'
}

function emptyCopyFor(toolName: string): string {
  switch (toolName) {
    case 'searchJobs':
      return 'No ads matched that filter. Try a broader region or occupation code.'
    case 'semanticSearch':
      return 'No ads matched that query. Try different keywords or a Swedish phrasing.'
    case 'triageBatch':
      return 'No ads to triage for that query.'
    case 'deadlineWatch':
      return 'No ads have a deadline inside the chosen window.'
    case 'compareRoles':
      return 'None of those ad ids matched the corpus.'
    case 'matchProfile':
      return 'That ad is no longer in the corpus.'
    default:
      return 'No results.'
  }
}
