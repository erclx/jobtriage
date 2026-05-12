export interface ToolCall {
  readonly toolCallId: string
  readonly toolName: string
  readonly input: unknown
  readonly output: unknown
  readonly errorText: string | null
}

export interface ParsedStream {
  readonly toolCalls: readonly ToolCall[]
  readonly toolNames: readonly string[]
  readonly text: string
}

interface StreamEvent {
  readonly type: string
  readonly toolCallId?: string
  readonly toolName?: string
  readonly input?: unknown
  readonly output?: unknown
  readonly delta?: string
  readonly errorText?: string
}

const JOBTECH_CONCEPT_ID_RE = /^[A-Za-z0-9]{4}_[A-Za-z0-9]{3}_[A-Za-z0-9]{3}$/

export function parseSseStream(stream: string): ParsedStream {
  const calls = new Map<
    string,
    { name: string; input: unknown; output: unknown; errorText: string | null }
  >()
  const order: string[] = []
  const textParts: string[] = []

  for (const rawLine of stream.split('\n')) {
    const line = rawLine.trimEnd()
    if (!line.startsWith('data:')) continue
    const payload = line.slice('data:'.length).trim()
    if (!payload || payload === '[DONE]') continue

    let event: StreamEvent
    try {
      event = JSON.parse(payload) as StreamEvent
    } catch {
      continue
    }

    if (event.type === 'text-delta' && typeof event.delta === 'string') {
      textParts.push(event.delta)
      continue
    }

    if (event.type === 'tool-input-available' && event.toolCallId) {
      const name = event.toolName ?? ''
      if (!calls.has(event.toolCallId)) {
        order.push(event.toolCallId)
      }
      calls.set(event.toolCallId, {
        name,
        input: event.input,
        output: undefined,
        errorText: null,
      })
      continue
    }

    if (event.type === 'tool-output-available' && event.toolCallId) {
      const existing = calls.get(event.toolCallId)
      if (existing) {
        existing.output = event.output
      }
      continue
    }

    if (
      (event.type === 'tool-output-error' || event.type === 'tool-error') &&
      event.toolCallId
    ) {
      const existing = calls.get(event.toolCallId)
      if (existing) {
        existing.errorText = event.errorText ?? 'tool error'
      }
      continue
    }
  }

  const toolCalls: ToolCall[] = order.map((id) => {
    const entry = calls.get(id)
    if (!entry) {
      return {
        toolCallId: id,
        toolName: '',
        input: undefined,
        output: undefined,
        errorText: null,
      }
    }
    return {
      toolCallId: id,
      toolName: entry.name,
      input: entry.input,
      output: entry.output,
      errorText: entry.errorText,
    }
  })

  const toolNames = toolCalls.map((c) => c.toolName).filter(Boolean)

  return { toolCalls, toolNames, text: textParts.join('') }
}

export interface ConversationPassCriteria {
  readonly tool_call_accuracy?: number
  readonly ad_id_recall_at_k?: number
  readonly keyword_recall?: number
}

export type AdIdScope = 'local-only' | 'skip'

export interface ConversationProbe {
  readonly slug: string
  readonly category: string
  readonly profileKey?: string
  readonly prompt: string
  readonly expected_tools: readonly string[]
  readonly expected_tool_order?: boolean
  readonly expected_ad_ids?: readonly string[]
  readonly ad_id_scope?: AdIdScope
  readonly expected_keywords?: readonly string[]
  readonly concept_id_discipline?: boolean
  readonly recovery_required?: boolean
  readonly recovery_tool?: string
  readonly forceDeploy?: boolean
  readonly pass_criteria?: ConversationPassCriteria
}

export interface ConversationFixture {
  readonly name: string
  readonly description: string
  readonly kind: 'conversation'
  readonly profiles?: Readonly<Record<string, string>>
  readonly pass_criteria: Required<ConversationPassCriteria>
  readonly probes: readonly ConversationProbe[]
}

export interface ConversationVerdict {
  readonly toolCallAccuracy: number
  readonly adIdRecall: number | null
  readonly keywordRecall: number | null
  readonly conceptIdDisciplineOk: boolean | null
  readonly recoveryObserved: boolean | null
  readonly pass: boolean
}

export function evaluateToolCallAccuracy(
  probe: ConversationProbe,
  toolNames: readonly string[],
): number {
  if (probe.expected_tools.length === 0) {
    return toolNames.length === 0 ? 1 : 0
  }
  if (probe.expected_tool_order) {
    let cursor = 0
    for (const name of toolNames) {
      if (name === probe.expected_tools[cursor]) cursor++
      if (cursor === probe.expected_tools.length) return 1
    }
    return cursor / probe.expected_tools.length
  }
  const actual = new Set(toolNames)
  const hits = probe.expected_tools.filter((name) => actual.has(name)).length
  return hits / probe.expected_tools.length
}

function collectAdIds(toolCalls: readonly ToolCall[]): Set<string> {
  const ids = new Set<string>()
  for (const call of toolCalls) {
    if (!call.output) continue
    walkAdIds(call.output, ids)
  }
  return ids
}

function walkAdIds(node: unknown, ids: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) walkAdIds(item, ids)
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      if ((key === 'ad_id' || key === 'id') && typeof value === 'string') {
        ids.add(value)
      } else {
        walkAdIds(value, ids)
      }
    }
  }
}

export function evaluateAdIdRecall(
  probe: ConversationProbe,
  toolCalls: readonly ToolCall[],
): number | null {
  if (probe.ad_id_scope === 'skip' || !probe.expected_ad_ids?.length) {
    return null
  }
  const observed = collectAdIds(toolCalls)
  const hits = probe.expected_ad_ids.filter((id) => observed.has(id)).length
  return hits / probe.expected_ad_ids.length
}

export function evaluateKeywordRecall(
  probe: ConversationProbe,
  text: string,
): number | null {
  if (!probe.expected_keywords?.length) return null
  const haystack = text.toLowerCase()
  const hits = probe.expected_keywords.filter((kw) =>
    haystack.includes(kw.toLowerCase()),
  ).length
  return hits / probe.expected_keywords.length
}

export function evaluateConceptIdDiscipline(
  probe: ConversationProbe,
  toolCalls: readonly ToolCall[],
): boolean | null {
  if (!probe.concept_id_discipline) return null
  const lookupIndex = toolCalls.findIndex((c) => c.toolName === 'lookupConcept')
  const searchIndex = toolCalls.findIndex((c) => c.toolName === 'searchJobs')

  if (searchIndex === -1) return true

  if (lookupIndex !== -1 && lookupIndex < searchIndex) return true

  const searchCall = toolCalls[searchIndex]
  const input = searchCall?.input as
    | { occupation_concept_id?: unknown; region?: unknown }
    | undefined
  const ids = [input?.occupation_concept_id, input?.region].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )
  if (ids.length === 0) return true
  return ids.every((id) => JOBTECH_CONCEPT_ID_RE.test(id))
}

export function evaluateRecovery(
  probe: ConversationProbe,
  toolCalls: readonly ToolCall[],
): boolean | null {
  if (!probe.recovery_required) return null
  const errorIndex = toolCalls.findIndex((c) => c.errorText !== null)
  if (errorIndex === -1) return false
  const recoveryTool = probe.recovery_tool
  if (!recoveryTool) return errorIndex < toolCalls.length - 1
  return toolCalls
    .slice(errorIndex + 1)
    .some((c) => c.toolName === recoveryTool)
}

function thresholdFor(
  probe: ConversationProbe,
  fixture: Pick<ConversationFixture, 'pass_criteria'>,
  key: keyof ConversationPassCriteria,
): number {
  const override = probe.pass_criteria?.[key]
  if (typeof override === 'number') return override
  return fixture.pass_criteria[key]
}

export function evaluateConversationProbe(
  probe: ConversationProbe,
  fixture: Pick<ConversationFixture, 'pass_criteria'>,
  parsed: ParsedStream,
): ConversationVerdict {
  const toolCallAccuracy = evaluateToolCallAccuracy(probe, parsed.toolNames)
  const adIdRecall = evaluateAdIdRecall(probe, parsed.toolCalls)
  const keywordRecall = evaluateKeywordRecall(probe, parsed.text)
  const conceptIdDisciplineOk = evaluateConceptIdDiscipline(
    probe,
    parsed.toolCalls,
  )
  const recoveryObserved = evaluateRecovery(probe, parsed.toolCalls)

  const toolThreshold = thresholdFor(probe, fixture, 'tool_call_accuracy')
  const adIdThreshold = thresholdFor(probe, fixture, 'ad_id_recall_at_k')
  const keywordThreshold = thresholdFor(probe, fixture, 'keyword_recall')

  const checks: boolean[] = [toolCallAccuracy >= toolThreshold]
  if (adIdRecall !== null) checks.push(adIdRecall >= adIdThreshold)
  if (keywordRecall !== null) checks.push(keywordRecall >= keywordThreshold)
  if (conceptIdDisciplineOk !== null) checks.push(conceptIdDisciplineOk)
  if (recoveryObserved !== null) checks.push(recoveryObserved)

  return {
    toolCallAccuracy,
    adIdRecall,
    keywordRecall,
    conceptIdDisciplineOk,
    recoveryObserved,
    pass: checks.every(Boolean),
  }
}

export interface ConversationProbeReport {
  readonly probeSlug: string
  readonly category: string
  readonly model: string
  readonly verdict: ConversationVerdict
  readonly toolNames: readonly string[]
  readonly latencyMs: number
  readonly error: string | null
  readonly textPreview: string
}

export interface ConversationSummary {
  readonly model: string
  readonly passed: number
  readonly total: number
  readonly avgToolCallAccuracy: number
  readonly avgAdIdRecall: number | null
  readonly avgKeywordRecall: number | null
  readonly avgLatencyMs: number
  readonly errors: number
}

export function summarizeConversation(
  model: string,
  reports: readonly ConversationProbeReport[],
): ConversationSummary {
  const ok = reports.filter((r) => !r.error)
  const passed = ok.filter((r) => r.verdict.pass).length
  const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
  const toolValues = ok.map((r) => r.verdict.toolCallAccuracy)
  const adIdValues = ok
    .map((r) => r.verdict.adIdRecall)
    .filter((v): v is number => v !== null)
  const keywordValues = ok
    .map((r) => r.verdict.keywordRecall)
    .filter((v): v is number => v !== null)
  const avg = (xs: readonly number[]): number =>
    xs.length === 0 ? 0 : sum(xs) / xs.length
  return {
    model,
    passed,
    total: reports.length,
    avgToolCallAccuracy: avg(toolValues),
    avgAdIdRecall: adIdValues.length === 0 ? null : avg(adIdValues),
    avgKeywordRecall: keywordValues.length === 0 ? null : avg(keywordValues),
    avgLatencyMs:
      ok.length === 0
        ? 0
        : Math.round(sum(ok.map((r) => r.latencyMs)) / ok.length),
    errors: reports.filter((r) => r.error).length,
  }
}

function pct(value: number | null): string {
  if (value === null) return '-'
  return `${Math.round(value * 100)}%`
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export function renderConversationMarkdown(
  fixture: ConversationFixture,
  reports: readonly ConversationProbeReport[],
  summaries: readonly ConversationSummary[],
  endpoint: string,
  interProbeMs: number,
): string {
  const lines: string[] = []
  lines.push(`# ${fixture.name} probe results`)
  lines.push('')
  lines.push(`Run at: ${new Date().toISOString()}`)
  lines.push(`Endpoint: ${endpoint}`)
  lines.push(`Fixture: ${fixture.name} (${fixture.kind})`)
  lines.push(`Inter-probe delay: ${interProbeMs}ms`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(
    '| Model | Passed | Tool-call accuracy | Ad-id recall | Keyword recall | Avg latency | Errors |',
  )
  lines.push('|---|---|---|---|---|---|---|')
  for (const s of summaries) {
    lines.push(
      `| \`${s.model}\` | ${s.passed}/${s.total} | ${pct(s.avgToolCallAccuracy)} | ${pct(s.avgAdIdRecall)} | ${pct(s.avgKeywordRecall)} | ${s.avgLatencyMs} ms | ${s.errors} |`,
    )
  }

  lines.push('')
  lines.push('## Per-probe detail')
  lines.push('')
  lines.push(
    '| Model | Probe | Category | Tool calls | Tool acc | Ad-id | Keyword | Discipline | Recovery | Pass | Latency | Preview / error |',
  )
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of reports) {
    const detail = r.error
      ? `error: ${r.error.slice(0, 80)}`
      : r.textPreview || '(no text)'
    const discipline =
      r.verdict.conceptIdDisciplineOk === null
        ? '-'
        : r.verdict.conceptIdDisciplineOk
          ? '✓'
          : '✗'
    const recovery =
      r.verdict.recoveryObserved === null
        ? '-'
        : r.verdict.recoveryObserved
          ? '✓'
          : '✗'
    lines.push(
      `| \`${r.model}\` | ${r.probeSlug} | ${r.category} | ${r.toolNames.join(', ') || '-'} | ${pct(r.verdict.toolCallAccuracy)} | ${pct(r.verdict.adIdRecall)} | ${pct(r.verdict.keywordRecall)} | ${discipline} | ${recovery} | ${r.verdict.pass ? '✓' : '✗'} | ${r.latencyMs} ms | ${escapeCell(detail)} |`,
    )
  }

  return lines.join('\n')
}
