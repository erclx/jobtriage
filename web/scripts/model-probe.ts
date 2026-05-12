import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveInterProbeMs } from './lib/pacing'
import {
  type ConversationFixture,
  type ConversationProbe,
  type ConversationProbeReport,
  type ConversationSummary,
  evaluateConversationProbe,
  type ParsedStream,
  parseSseStream,
  renderConversationMarkdown,
  summarizeConversation,
} from './probe-eval'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..', '..')
const OUT_DIR = join(REPO_ROOT, '.claude', '.tmp', 'ollama-model-research')
const DEFAULT_FIXTURE = join(
  REPO_ROOT,
  '.claude',
  'evals',
  'agent-discipline.json',
)

const CHAT_URL = process.env.PROBE_CHAT_URL ?? 'http://localhost:3000/api/chat'
const REQUEST_TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS ?? '180000')
const RESTART_TIMEOUT_MS = Number(
  process.env.PROBE_RESTART_TIMEOUT_MS ?? '120000',
)
const FIXTURE_PATH = process.env.PROBE_FIXTURE
  ? join(REPO_ROOT, process.env.PROBE_FIXTURE)
  : DEFAULT_FIXTURE

const BYOK_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const
type ByokProvider = (typeof BYOK_PROVIDERS)[number]
type ProbeProvider = ByokProvider | 'ollama'

const RAW_PROVIDER = (process.env.PROBE_PROVIDER ?? 'ollama').toLowerCase()
const PROBE_PROVIDER: ProbeProvider = (
  BYOK_PROVIDERS as readonly string[]
).includes(RAW_PROVIDER)
  ? (RAW_PROVIDER as ByokProvider)
  : 'ollama'
const PROBE_API_KEY = process.env.PROBE_API_KEY ?? ''
const PROBE_MODEL_ID = process.env.PROBE_MODEL_ID ?? ''
const INTER_PROBE_MS = resolveInterProbeMs(PROBE_PROVIDER, process.env)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MODELS_FROM_ENV = process.env.PROBE_MODELS?.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const DEFAULT_OLLAMA_MODELS: readonly string[] = [
  'mistral-small3.2:24b',
  'gemma4:31b',
  'qwen3:32b',
  'qwen3:30b',
  'qwen3-coder:30b',
  'gemma4:26b',
]
const MODELS: readonly string[] =
  PROBE_PROVIDER === 'ollama'
    ? MODELS_FROM_ENV?.length
      ? MODELS_FROM_ENV
      : DEFAULT_OLLAMA_MODELS
    : [PROBE_MODEL_ID || PROBE_PROVIDER]

interface DisciplineProbe {
  readonly slug: string
  readonly prompt: string
  readonly category: string
  readonly expectTools: readonly string[]
}

interface LanguageProbe {
  readonly slug: string
  readonly prompt: string
  readonly category: string
  readonly expectLanguage: 'english' | 'swedish'
}

interface PairingProbe {
  readonly slug: string
  readonly prompt: string
  readonly category: string
  readonly expectTools: readonly string[]
  readonly fallbackSpatialTools?: readonly string[]
}

interface DisciplineFixture {
  readonly name: string
  readonly description: string
  readonly kind: 'discipline'
  readonly probes: readonly DisciplineProbe[]
}

interface LanguageFixture {
  readonly name: string
  readonly description: string
  readonly kind: 'language'
  readonly probes: readonly LanguageProbe[]
}

interface PairingFixture {
  readonly name: string
  readonly description: string
  readonly kind: 'pairing'
  readonly probes: readonly PairingProbe[]
}

interface GeneralProfileProbe {
  readonly slug: string
  readonly prompt: string
  readonly category: string
  readonly profileKey: string
  readonly expectTools: readonly string[]
}

interface GeneralProfileFixture {
  readonly name: string
  readonly description: string
  readonly kind: 'general-profile'
  readonly profiles: Readonly<Record<string, string>>
  readonly probes: readonly GeneralProfileProbe[]
}

type Fixture =
  | DisciplineFixture
  | LanguageFixture
  | PairingFixture
  | GeneralProfileFixture
  | ConversationFixture

type AnyProbe =
  | DisciplineProbe
  | LanguageProbe
  | PairingProbe
  | GeneralProfileProbe
  | ConversationProbe

async function loadFixture(path: string): Promise<Fixture> {
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw) as Fixture
  if (
    parsed.kind !== 'discipline' &&
    parsed.kind !== 'language' &&
    parsed.kind !== 'pairing' &&
    parsed.kind !== 'general-profile' &&
    parsed.kind !== 'conversation'
  ) {
    throw new Error(`Unsupported fixture kind in ${path}`)
  }
  return parsed
}

interface ProbeResult {
  readonly model: string
  readonly probeSlug: string
  readonly category: string
  readonly toolNames: readonly string[]
  readonly latencyMs: number
  readonly textPreview: string
  readonly fullText: string
  readonly parsed: ParsedStream
  readonly error?: string
}

function buildBody(prompt: string, profile: string | null): string {
  return JSON.stringify({
    messages: [
      {
        id: `u-${Date.now()}`,
        role: 'user',
        parts: [{ type: 'text', text: prompt }],
      },
    ],
    profile,
  })
}

function uniquePreservingOrder(names: readonly string[]): readonly string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

const SWEDISH_MARKERS: ReadonlySet<string> = new Set([
  'jag',
  'är',
  'du',
  'hur',
  'går',
  'det',
  'hej',
  'tjena',
  'vad',
  'kan',
  'hjälpa',
  'karriär',
  'dig',
  'för',
  'att',
  'och',
  'tack',
  'från',
  'mig',
  'din',
  'med',
  'ditt',
])

function detectLanguage(text: string): 'english' | 'swedish' {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
  const hits = new Set<string>()
  for (const word of words) {
    if (SWEDISH_MARKERS.has(word)) {
      hits.add(word)
    }
  }
  return hits.size >= 2 ? 'swedish' : 'english'
}

async function runProbe(
  model: string,
  probe: AnyProbe,
  options: { profile?: string | null; forceDeploy?: boolean } = {},
): Promise<ProbeResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-jobtriage-provider': PROBE_PROVIDER,
  }
  if (PROBE_PROVIDER !== 'ollama' && PROBE_API_KEY) {
    headers.authorization = `Bearer ${PROBE_API_KEY}`
  }
  if (options.forceDeploy) {
    headers['x-jobtriage-mode'] = 'deploy'
  }

  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers,
      body: buildBody(probe.prompt, options.profile ?? null),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        model,
        probeSlug: probe.slug,
        category: probe.category,
        toolNames: [],
        latencyMs: Date.now() - start,
        textPreview: '',
        fullText: '',
        parsed: { toolCalls: [], toolNames: [], text: '' },
        error: `HTTP ${response.status}: ${errorText.slice(0, 160)}`,
      }
    }

    const stream = await response.text()
    const latencyMs = Date.now() - start
    const parsed = parseSseStream(stream)
    const toolNames = uniquePreservingOrder(parsed.toolNames)
    const textPreview = parsed.text.replaceAll(/\s+/g, ' ').slice(0, 120)

    return {
      model,
      probeSlug: probe.slug,
      category: probe.category,
      toolNames,
      latencyMs,
      textPreview,
      fullText: parsed.text,
      parsed,
    }
  } catch (error) {
    return {
      model,
      probeSlug: probe.slug,
      category: probe.category,
      toolNames: [],
      latencyMs: Date.now() - start,
      textPreview: '',
      fullText: '',
      parsed: { toolCalls: [], toolNames: [], text: '' },
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function restartWebForModel(model: string): Promise<void> {
  process.stdout.write(`  restart:web with OLLAMA_MODEL_ID=${model}\n`)
  await new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['run', 'restart:web'], {
      cwd: REPO_ROOT,
      env: { ...process.env, OLLAMA_MODEL_ID: model },
      stdio: 'inherit',
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('restart:web timed out'))
    }, RESTART_TIMEOUT_MS)
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`restart:web exited ${code}`))
      }
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

interface DisciplineSummary {
  readonly kind: 'discipline'
  readonly model: string
  readonly chitchatFalsePositives: number
  readonly chitchatTotal: number
  readonly toolWarrantedCorrect: number
  readonly toolWarrantedTotal: number
  readonly avgLatencyMs: number
  readonly errors: number
}

interface LanguageSummary {
  readonly kind: 'language'
  readonly model: string
  readonly correct: number
  readonly total: number
  readonly avgLatencyMs: number
  readonly errors: number
}

interface PairingSummary {
  readonly kind: 'pairing'
  readonly model: string
  readonly fullPair: number
  readonly partial: number
  readonly missingPair: number
  readonly total: number
  readonly avgLatencyMs: number
  readonly errors: number
}

interface GeneralProfileSummary {
  readonly kind: 'general-profile'
  readonly model: string
  readonly fullPair: number
  readonly partial: number
  readonly missingPair: number
  readonly total: number
  readonly avgLatencyMs: number
  readonly errors: number
}

interface ConversationSummaryWithKind extends ConversationSummary {
  readonly kind: 'conversation'
}

type ModelSummary =
  | DisciplineSummary
  | LanguageSummary
  | PairingSummary
  | GeneralProfileSummary
  | ConversationSummaryWithKind

function avgLatency(results: readonly ProbeResult[]): number {
  const ok = results.filter((r) => !r.error)
  if (ok.length === 0) return 0
  return Math.round(ok.reduce((s, r) => s + r.latencyMs, 0) / ok.length)
}

function summarizeDiscipline(
  model: string,
  fixture: DisciplineFixture,
  results: readonly ProbeResult[],
): DisciplineSummary {
  const probesBySlug = new Map(fixture.probes.map((p) => [p.slug, p]))
  const chitchat = results.filter(
    (r) => probesBySlug.get(r.probeSlug)?.category === 'chitchat',
  )
  const tool = results.filter(
    (r) => probesBySlug.get(r.probeSlug)?.category === 'tool-warranted',
  )
  const chitchatFalsePositives = chitchat.filter(
    (r) => r.toolNames.length > 0,
  ).length
  const toolWarrantedCorrect = tool.filter((r) => {
    const probe = probesBySlug.get(r.probeSlug)
    if (!probe) return false
    return (
      r.toolNames.length > 0 &&
      r.toolNames.some((name) => probe.expectTools.includes(name))
    )
  }).length
  return {
    kind: 'discipline',
    model,
    chitchatFalsePositives,
    chitchatTotal: chitchat.length,
    toolWarrantedCorrect,
    toolWarrantedTotal: tool.length,
    avgLatencyMs: avgLatency(results),
    errors: results.filter((r) => r.error).length,
  }
}

type PairingVerdict = 'full' | 'partial' | 'missing' | 'unexpected-tool'

function evaluatePairing(
  probe: PairingProbe,
  toolNames: readonly string[],
): PairingVerdict {
  if (probe.expectTools.length === 0) {
    return toolNames.length === 0 ? 'full' : 'unexpected-tool'
  }
  const hits = probe.expectTools.filter((name) => toolNames.includes(name))
  const fallbackSpatial = probe.fallbackSpatialTools ?? []
  if (hits.length === probe.expectTools.length) return 'full'
  if (
    hits.length === probe.expectTools.length - 1 &&
    fallbackSpatial.some((name) => toolNames.includes(name))
  ) {
    return 'full'
  }
  if (hits.length > 0) return 'partial'
  return 'missing'
}

function evaluateGeneralProfile(
  probe: GeneralProfileProbe,
  toolNames: readonly string[],
): PairingVerdict {
  if (probe.expectTools.length === 0) {
    return toolNames.length === 0 ? 'full' : 'unexpected-tool'
  }
  const hits = probe.expectTools.filter((name) => toolNames.includes(name))
  if (hits.length === probe.expectTools.length) return 'full'
  if (hits.length > 0) return 'partial'
  return 'missing'
}

function summarizeGeneralProfile(
  model: string,
  fixture: GeneralProfileFixture,
  results: readonly ProbeResult[],
): GeneralProfileSummary {
  const probesBySlug = new Map(fixture.probes.map((p) => [p.slug, p]))
  let fullPair = 0
  let partial = 0
  let missingPair = 0
  for (const result of results) {
    if (result.error) continue
    const probe = probesBySlug.get(result.probeSlug)
    if (!probe) continue
    const verdict = evaluateGeneralProfile(probe, result.toolNames)
    if (verdict === 'full') fullPair++
    else if (verdict === 'partial') partial++
    else missingPair++
  }
  return {
    kind: 'general-profile',
    model,
    fullPair,
    partial,
    missingPair,
    total: results.length,
    avgLatencyMs: avgLatency(results),
    errors: results.filter((r) => r.error).length,
  }
}

function summarizePairing(
  model: string,
  fixture: PairingFixture,
  results: readonly ProbeResult[],
): PairingSummary {
  const probesBySlug = new Map(fixture.probes.map((p) => [p.slug, p]))
  let fullPair = 0
  let partial = 0
  let missingPair = 0
  for (const result of results) {
    if (result.error) continue
    const probe = probesBySlug.get(result.probeSlug)
    if (!probe) continue
    const verdict = evaluatePairing(probe, result.toolNames)
    if (verdict === 'full') fullPair++
    else if (verdict === 'partial') partial++
    else missingPair++
  }
  return {
    kind: 'pairing',
    model,
    fullPair,
    partial,
    missingPair,
    total: results.length,
    avgLatencyMs: avgLatency(results),
    errors: results.filter((r) => r.error).length,
  }
}

function summarizeLanguage(
  model: string,
  fixture: LanguageFixture,
  results: readonly ProbeResult[],
): LanguageSummary {
  const probesBySlug = new Map(fixture.probes.map((p) => [p.slug, p]))
  let correct = 0
  for (const r of results) {
    if (r.error) continue
    const probe = probesBySlug.get(r.probeSlug)
    if (!probe) continue
    const detected = detectLanguage(r.fullText)
    if (detected === probe.expectLanguage) correct++
  }
  return {
    kind: 'language',
    model,
    correct,
    total: results.length,
    avgLatencyMs: avgLatency(results),
    errors: results.filter((r) => r.error).length,
  }
}

function renderMarkdown(
  fixture: Fixture,
  results: readonly ProbeResult[],
  summaries: readonly ModelSummary[],
): string {
  if (fixture.kind === 'conversation') {
    return renderConversationMarkdown(
      fixture,
      conversationReports(results, fixture),
      summaries.flatMap((s) => (s.kind === 'conversation' ? [s] : [])),
      CHAT_URL,
      INTER_PROBE_MS,
    )
  }

  const lines: string[] = []
  lines.push(`# ${fixture.name} probe results`)
  lines.push('')
  lines.push(`Run at: ${new Date().toISOString()}`)
  lines.push(`Endpoint: ${CHAT_URL}`)
  lines.push(`Fixture: ${fixture.name} (${fixture.kind})`)
  lines.push(`Inter-probe delay: ${INTER_PROBE_MS}ms`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')

  if (fixture.kind === 'discipline') {
    lines.push(
      '| Model | Chitchat false-positives | Tool-warranted correct | Avg latency | Errors |',
    )
    lines.push('|---|---|---|---|---|')
    for (const s of summaries) {
      if (s.kind !== 'discipline') continue
      lines.push(
        `| \`${s.model}\` | ${s.chitchatFalsePositives}/${s.chitchatTotal} | ${s.toolWarrantedCorrect}/${s.toolWarrantedTotal} | ${s.avgLatencyMs} ms | ${s.errors} |`,
      )
    }
  } else if (fixture.kind === 'pairing') {
    lines.push(
      '| Model | Full pair | Partial | Missing pair | Avg latency | Errors |',
    )
    lines.push('|---|---|---|---|---|---|')
    for (const s of summaries) {
      if (s.kind !== 'pairing') continue
      lines.push(
        `| \`${s.model}\` | ${s.fullPair}/${s.total} | ${s.partial} | ${s.missingPair} | ${s.avgLatencyMs} ms | ${s.errors} |`,
      )
    }
  } else if (fixture.kind === 'general-profile') {
    lines.push(
      '| Model | Full pair | Partial | Missing | Avg latency | Errors |',
    )
    lines.push('|---|---|---|---|---|---|')
    for (const s of summaries) {
      if (s.kind !== 'general-profile') continue
      lines.push(
        `| \`${s.model}\` | ${s.fullPair}/${s.total} | ${s.partial} | ${s.missingPair} | ${s.avgLatencyMs} ms | ${s.errors} |`,
      )
    }
    lines.push('')
    lines.push('### Per-profession breakdown')
    lines.push('')
    const probesBySlug = new Map(fixture.probes.map((p) => [p.slug, p]))
    const profileKeys = Array.from(
      new Set(fixture.probes.map((p) => p.profileKey)),
    )
    lines.push(`| Model | ${profileKeys.join(' | ')} |`)
    lines.push(`|---|${profileKeys.map(() => '---').join('|')}|`)
    for (const s of summaries) {
      if (s.kind !== 'general-profile') continue
      const cells = profileKeys.map((key) => {
        const slugsForKey = fixture.probes
          .filter((p) => p.profileKey === key)
          .map((p) => p.slug)
        const subset = results.filter(
          (r) => r.model === s.model && slugsForKey.includes(r.probeSlug),
        )
        let full = 0
        for (const r of subset) {
          if (r.error) continue
          const probe = probesBySlug.get(r.probeSlug)
          if (!probe) continue
          if (evaluateGeneralProfile(probe, r.toolNames) === 'full') full++
        }
        return `${full}/${subset.length}`
      })
      lines.push(`| \`${s.model}\` | ${cells.join(' | ')} |`)
    }
  } else {
    lines.push('| Model | Language match | Avg latency | Errors |')
    lines.push('|---|---|---|---|')
    for (const s of summaries) {
      if (s.kind !== 'language') continue
      lines.push(
        `| \`${s.model}\` | ${s.correct}/${s.total} | ${s.avgLatencyMs} ms | ${s.errors} |`,
      )
    }
  }

  lines.push('')
  lines.push('## Per-probe detail')
  lines.push('')

  if (fixture.kind === 'discipline') {
    lines.push(
      '| Model | Probe | Category | Tool calls | Latency | Preview / error |',
    )
    lines.push('|---|---|---|---|---|---|')
    for (const r of results) {
      const detail = r.error
        ? `error: ${r.error.slice(0, 80)}`
        : r.textPreview || '(no text)'
      lines.push(
        `| \`${r.model}\` | ${r.probeSlug} | ${r.category} | ${r.toolNames.join(', ') || '-'} | ${r.latencyMs} ms | ${detail.replaceAll('|', '\\|')} |`,
      )
    }
  } else if (fixture.kind === 'pairing') {
    const probesBySlug = new Map(fixture.probes.map((p) => [p.slug, p]))
    lines.push(
      '| Model | Probe | Expected | Tool calls | Verdict | Latency | Preview / error |',
    )
    lines.push('|---|---|---|---|---|---|---|')
    for (const r of results) {
      const probe = probesBySlug.get(r.probeSlug)
      const expected = probe ? probe.expectTools.join(' + ') || 'none' : '?'
      const verdict = probe ? evaluatePairing(probe, r.toolNames) : 'missing'
      const verdictGlyph =
        verdict === 'full'
          ? '✓'
          : verdict === 'partial'
            ? '~'
            : verdict === 'unexpected-tool'
              ? '!'
              : '✗'
      const detail = r.error
        ? `error: ${r.error.slice(0, 80)}`
        : r.textPreview || '(no text)'
      lines.push(
        `| \`${r.model}\` | ${r.probeSlug} | ${expected} | ${r.toolNames.join(', ') || '-'} | ${verdictGlyph} | ${r.latencyMs} ms | ${detail.replaceAll('|', '\\|')} |`,
      )
    }
  } else if (fixture.kind === 'general-profile') {
    const probesBySlug = new Map(fixture.probes.map((p) => [p.slug, p]))
    lines.push(
      '| Model | Probe | Profile | Expected | Tool calls | Verdict | Latency | Preview / error |',
    )
    lines.push('|---|---|---|---|---|---|---|---|')
    for (const r of results) {
      const probe = probesBySlug.get(r.probeSlug)
      const expected = probe ? probe.expectTools.join(' + ') || 'none' : '?'
      const verdict = probe
        ? evaluateGeneralProfile(probe, r.toolNames)
        : 'missing'
      const verdictGlyph =
        verdict === 'full'
          ? '✓'
          : verdict === 'partial'
            ? '~'
            : verdict === 'unexpected-tool'
              ? '!'
              : '✗'
      const detail = r.error
        ? `error: ${r.error.slice(0, 80)}`
        : r.textPreview || '(no text)'
      lines.push(
        `| \`${r.model}\` | ${r.probeSlug} | ${probe?.profileKey ?? '?'} | ${expected} | ${r.toolNames.join(', ') || '-'} | ${verdictGlyph} | ${r.latencyMs} ms | ${detail.replaceAll('|', '\\|')} |`,
      )
    }
  } else {
    const probesBySlug = new Map(fixture.probes.map((p) => [p.slug, p]))
    lines.push(
      '| Model | Probe | Expected | Detected | Match | Latency | Preview / error |',
    )
    lines.push('|---|---|---|---|---|---|---|')
    for (const r of results) {
      const probe = probesBySlug.get(r.probeSlug)
      const expected = probe?.expectLanguage ?? '?'
      const detected = r.error ? '-' : detectLanguage(r.fullText)
      const match = r.error ? '-' : detected === expected ? '✓' : '✗'
      const detail = r.error
        ? `error: ${r.error.slice(0, 80)}`
        : r.textPreview || '(no text)'
      lines.push(
        `| \`${r.model}\` | ${r.probeSlug} | ${expected} | ${detected} | ${match} | ${r.latencyMs} ms | ${detail.replaceAll('|', '\\|')} |`,
      )
    }
  }

  return lines.join('\n')
}

function summarizeForFixture(
  model: string,
  fixture: Fixture,
  results: readonly ProbeResult[],
): ModelSummary {
  if (fixture.kind === 'discipline') {
    return summarizeDiscipline(model, fixture, results)
  }
  if (fixture.kind === 'pairing') {
    return summarizePairing(model, fixture, results)
  }
  if (fixture.kind === 'general-profile') {
    return summarizeGeneralProfile(model, fixture, results)
  }
  if (fixture.kind === 'conversation') {
    const reports = conversationReports(
      results.filter((r) => r.model === model),
      fixture,
    )
    return { kind: 'conversation', ...summarizeConversation(model, reports) }
  }
  return summarizeLanguage(model, fixture, results)
}

function conversationReports(
  results: readonly ProbeResult[],
  fixture: ConversationFixture,
): readonly ConversationProbeReport[] {
  const probesBySlug = new Map(fixture.probes.map((p) => [p.slug, p]))
  return results.flatMap((result) => {
    const probe = probesBySlug.get(result.probeSlug)
    if (!probe) return []
    const verdict = result.error
      ? {
          toolCallAccuracy: 0,
          adIdRecall: null,
          keywordRecall: null,
          conceptIdDisciplineOk: null,
          recoveryObserved: null,
          pass: false,
        }
      : evaluateConversationProbe(probe, fixture, result.parsed)
    return [
      {
        probeSlug: result.probeSlug,
        category: result.category,
        model: result.model,
        toolNames: result.toolNames,
        latencyMs: result.latencyMs,
        textPreview: result.textPreview,
        error: result.error ?? null,
        verdict,
      },
    ]
  })
}

function probeVerdict(fixture: Fixture, result: ProbeResult): string {
  if (result.error) return `ERR ${result.error.slice(0, 60)}`
  if (fixture.kind === 'discipline') {
    return `tools: ${result.toolNames.join(',') || '-'}`
  }
  if (fixture.kind === 'pairing') {
    const probe = fixture.probes.find((p) => p.slug === result.probeSlug)
    if (!probe) return 'missing probe'
    const verdict = evaluatePairing(probe, result.toolNames)
    return `pair: ${verdict} (got ${result.toolNames.join(',') || '-'})`
  }
  if (fixture.kind === 'general-profile') {
    const probe = fixture.probes.find((p) => p.slug === result.probeSlug)
    if (!probe) return 'missing probe'
    const verdict = evaluateGeneralProfile(probe, result.toolNames)
    return `gen: ${verdict} (got ${result.toolNames.join(',') || '-'})`
  }
  if (fixture.kind === 'conversation') {
    const probe = fixture.probes.find((p) => p.slug === result.probeSlug)
    if (!probe) return 'missing probe'
    const verdict = evaluateConversationProbe(probe, fixture, result.parsed)
    return `conversation: ${verdict.pass ? '✓' : '✗'} (tools: ${result.toolNames.join(',') || '-'})`
  }
  const probe = fixture.probes.find((p) => p.slug === result.probeSlug) as
    | LanguageProbe
    | undefined
  const detected = detectLanguage(result.fullText)
  const match = detected === probe?.expectLanguage ? '✓' : '✗'
  return `lang: ${detected} ${match} (expected ${probe?.expectLanguage ?? '?'})`
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
  const fixture = await loadFixture(FIXTURE_PATH)
  process.stdout.write(
    `Fixture: ${fixture.name} (${fixture.kind}) from ${FIXTURE_PATH}\n`,
  )
  process.stdout.write(`Probes: ${fixture.probes.length}\n`)

  const allResults: ProbeResult[] = []
  const summaries: ModelSummary[] = []

  if (PROBE_PROVIDER !== 'ollama') {
    process.stdout.write(
      `Provider: ${PROBE_PROVIDER} (BYOK, restart:web skipped)\n`,
    )
    if (!PROBE_API_KEY) {
      throw new Error(`PROBE_PROVIDER=${PROBE_PROVIDER} requires PROBE_API_KEY`)
    }
  }

  const skipRestart = process.env.PROBE_SKIP_RESTART === '1'

  for (const model of MODELS) {
    process.stdout.write(`\n=== ${model} ===\n`)
    if (PROBE_PROVIDER === 'ollama' && !skipRestart) {
      try {
        await restartWebForModel(model)
      } catch (error) {
        process.stdout.write(
          `  restart failed: ${error instanceof Error ? error.message : String(error)}\n`,
        )
        const failure: ProbeResult = {
          model,
          probeSlug: 'restart',
          category: 'restart',
          toolNames: [],
          latencyMs: 0,
          textPreview: '',
          fullText: '',
          parsed: { toolCalls: [], toolNames: [], text: '' },
          error: 'restart:web failed',
        }
        allResults.push(failure)
        summaries.push(summarizeForFixture(model, fixture, [failure]))
        continue
      }
    }

    const modelResults: ProbeResult[] = []
    for (const [index, probe] of fixture.probes.entries()) {
      if (index > 0 && INTER_PROBE_MS > 0) {
        await sleep(INTER_PROBE_MS)
      }
      const profile = resolveProbeProfile(fixture, probe)
      const result = await runProbe(model, probe, {
        profile,
        forceDeploy: shouldForceDeploy(fixture, probe),
      })
      modelResults.push(result)
      process.stdout.write(
        `  ${probe.category.padEnd(20)} ${probe.slug.padEnd(22)} ${result.latencyMs.toString().padStart(6)}ms  ${probeVerdict(fixture, result)}\n`,
      )
    }
    allResults.push(...modelResults)
    summaries.push(summarizeForFixture(model, fixture, modelResults))
  }

  const markdown = renderMarkdown(fixture, allResults, summaries)
  const outPath = join(OUT_DIR, `smoke-${PROBE_PROVIDER}-${fixture.name}.md`)
  await writeFile(outPath, `${markdown}\n`)
  const jsonPath = join(OUT_DIR, `smoke-${PROBE_PROVIDER}-${fixture.name}.json`)
  await writeFile(
    jsonPath,
    `${JSON.stringify(
      {
        fixture: fixture.name,
        kind: fixture.kind,
        provider: PROBE_PROVIDER,
        endpoint: CHAT_URL,
        runAt: new Date().toISOString(),
        summaries,
        results: allResults.map(({ parsed: _parsed, ...rest }) => rest),
      },
      null,
      2,
    )}\n`,
  )
  process.stdout.write(`\n\nWrote ${outPath}\n`)
  process.stdout.write(`Wrote ${jsonPath}\n\n`)
  process.stdout.write(markdown)
  process.stdout.write('\n')
}

function resolveProbeProfile(fixture: Fixture, probe: AnyProbe): string | null {
  if (fixture.kind === 'general-profile') {
    const key = (probe as GeneralProfileProbe).profileKey
    return fixture.profiles[key] ?? null
  }
  if (fixture.kind === 'conversation') {
    const key = (probe as ConversationProbe).profileKey
    if (!key) return null
    return fixture.profiles?.[key] ?? null
  }
  return null
}

function shouldForceDeploy(fixture: Fixture, probe: AnyProbe): boolean {
  if (fixture.kind === 'general-profile') return true
  if (fixture.kind === 'conversation') {
    return Boolean((probe as ConversationProbe).forceDeploy)
  }
  return false
}

await main()
