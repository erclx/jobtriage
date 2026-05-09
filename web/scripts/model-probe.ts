import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const MODELS_FROM_ENV = process.env.PROBE_MODELS?.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const MODELS: readonly string[] = MODELS_FROM_ENV?.length
  ? MODELS_FROM_ENV
  : [
      'mistral-small3.2:24b',
      'gemma4:31b',
      'qwen3:32b',
      'qwen3:30b',
      'qwen3-coder:30b',
      'gemma4:26b',
    ]

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

type Fixture = DisciplineFixture | LanguageFixture | PairingFixture

async function loadFixture(path: string): Promise<Fixture> {
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw) as Fixture
  if (
    parsed.kind !== 'discipline' &&
    parsed.kind !== 'language' &&
    parsed.kind !== 'pairing'
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
  readonly error?: string
}

function buildBody(prompt: string): string {
  return JSON.stringify({
    messages: [
      {
        id: `u-${Date.now()}`,
        role: 'user',
        parts: [{ type: 'text', text: prompt }],
      },
    ],
    profile: null,
  })
}

const TOOL_NAME_RE = /"toolName":"([a-zA-Z]+)"/g
const TEXT_DELTA_RE = /"delta":"((?:[^"\\]|\\.)*)"/g

function parseSse(stream: string): {
  readonly toolNames: readonly string[]
  readonly text: string
} {
  const toolNames: string[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = TOOL_NAME_RE.exec(stream)) !== null) {
    const name = m[1]
    if (name && !seen.has(name)) {
      seen.add(name)
      toolNames.push(name)
    }
  }

  const textParts: string[] = []
  while ((m = TEXT_DELTA_RE.exec(stream)) !== null) {
    try {
      textParts.push(JSON.parse(`"${m[1]}"`) as string)
    } catch {
      textParts.push(m[1] ?? '')
    }
  }
  return { toolNames, text: textParts.join('') }
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
  probe: DisciplineProbe | LanguageProbe | PairingProbe,
): Promise<ProbeResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-jobtriage-provider': 'ollama',
      },
      body: buildBody(probe.prompt),
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
        error: `HTTP ${response.status}: ${errorText.slice(0, 160)}`,
      }
    }

    const stream = await response.text()
    const latencyMs = Date.now() - start
    const { toolNames, text } = parseSse(stream)
    const textPreview = text.replaceAll(/\s+/g, ' ').slice(0, 120)

    return {
      model,
      probeSlug: probe.slug,
      category: probe.category,
      toolNames,
      latencyMs,
      textPreview,
      fullText: text,
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

type ModelSummary = DisciplineSummary | LanguageSummary | PairingSummary

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
  const lines: string[] = []
  lines.push(`# ${fixture.name} probe results`)
  lines.push('')
  lines.push(`Run at: ${new Date().toISOString()}`)
  lines.push(`Endpoint: ${CHAT_URL}`)
  lines.push(`Fixture: ${fixture.name} (${fixture.kind})`)
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
  return summarizeLanguage(model, fixture, results)
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

  for (const model of MODELS) {
    process.stdout.write(`\n=== ${model} ===\n`)
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
        error: 'restart:web failed',
      }
      allResults.push(failure)
      summaries.push(summarizeForFixture(model, fixture, [failure]))
      continue
    }

    const modelResults: ProbeResult[] = []
    for (const probe of fixture.probes) {
      const result = await runProbe(model, probe)
      modelResults.push(result)
      process.stdout.write(
        `  ${probe.category.padEnd(20)} ${probe.slug.padEnd(22)} ${result.latencyMs.toString().padStart(6)}ms  ${probeVerdict(fixture, result)}\n`,
      )
    }
    allResults.push(...modelResults)
    summaries.push(summarizeForFixture(model, fixture, modelResults))
  }

  const markdown = renderMarkdown(fixture, allResults, summaries)
  const outPath = join(OUT_DIR, `smoke-${fixture.name}.md`)
  await writeFile(outPath, `${markdown}\n`)
  process.stdout.write(`\n\nWrote ${outPath}\n\n`)
  process.stdout.write(markdown)
  process.stdout.write('\n')
}

await main()
