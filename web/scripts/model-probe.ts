import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..', '..')
const OUT_DIR = join(REPO_ROOT, '.claude', '.tmp', 'ollama-model-research')

const CHAT_URL = process.env.PROBE_CHAT_URL ?? 'http://localhost:3000/api/chat'
const REQUEST_TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS ?? '180000')
const RESTART_TIMEOUT_MS = Number(
  process.env.PROBE_RESTART_TIMEOUT_MS ?? '120000',
)

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

interface ProbeCase {
  readonly slug: string
  readonly prompt: string
  readonly category: 'chitchat' | 'tool-warranted'
  readonly expectTools?: readonly string[]
}

const PROBES: readonly ProbeCase[] = [
  { slug: 'hi', prompt: 'hi', category: 'chitchat' },
  { slug: 'what-can-you-do', prompt: 'what can you do', category: 'chitchat' },
  { slug: 'how-are-you', prompt: 'how are you', category: 'chitchat' },
  { slug: 'thanks', prompt: 'thanks', category: 'chitchat' },
  {
    slug: 'what-is-jobtriage',
    prompt: 'what is jobtriage',
    category: 'chitchat',
  },
  {
    slug: 'welder-goteborg',
    prompt: 'find welder jobs in Göteborg',
    category: 'tool-warranted',
    expectTools: ['triageBatch', 'semanticSearch'],
  },
  {
    slug: 'expire-7-days',
    prompt: 'what ads expire in the next 7 days',
    category: 'tool-warranted',
    expectTools: ['deadlineWatch'],
  },
  {
    slug: 'agentic-roles',
    prompt: 'list roles about agentic AI systems',
    category: 'tool-warranted',
    expectTools: ['triageBatch', 'semanticSearch'],
  },
]

interface ProbeResult {
  readonly model: string
  readonly probeSlug: string
  readonly category: ProbeCase['category']
  readonly expectTools: readonly string[]
  readonly toolNames: readonly string[]
  readonly latencyMs: number
  readonly textPreview: string
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

async function runProbe(model: string, probe: ProbeCase): Promise<ProbeResult> {
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
        expectTools: probe.expectTools ?? [],
        toolNames: [],
        latencyMs: Date.now() - start,
        textPreview: '',
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
      expectTools: probe.expectTools ?? [],
      toolNames,
      latencyMs,
      textPreview,
    }
  } catch (error) {
    return {
      model,
      probeSlug: probe.slug,
      category: probe.category,
      expectTools: probe.expectTools ?? [],
      toolNames: [],
      latencyMs: Date.now() - start,
      textPreview: '',
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

interface ModelSummary {
  readonly model: string
  readonly chitchatFalsePositives: number
  readonly chitchatTotal: number
  readonly toolWarrantedCorrect: number
  readonly toolWarrantedTotal: number
  readonly avgLatencyMs: number
  readonly errors: number
}

function summarize(results: readonly ProbeResult[]): ModelSummary {
  const model = results[0]?.model ?? 'unknown'
  const chitchat = results.filter((r) => r.category === 'chitchat')
  const tool = results.filter((r) => r.category === 'tool-warranted')
  const chitchatFalsePositives = chitchat.filter(
    (r) => r.toolNames.length > 0,
  ).length
  const toolWarrantedCorrect = tool.filter(
    (r) =>
      r.toolNames.length > 0 &&
      r.toolNames.some((name) => r.expectTools.includes(name)),
  ).length
  const errors = results.filter((r) => r.error).length
  const okResults = results.filter((r) => !r.error)
  const avgLatencyMs =
    okResults.length === 0
      ? 0
      : Math.round(
          okResults.reduce((sum, r) => sum + r.latencyMs, 0) / okResults.length,
        )
  return {
    model,
    chitchatFalsePositives,
    chitchatTotal: chitchat.length,
    toolWarrantedCorrect,
    toolWarrantedTotal: tool.length,
    avgLatencyMs,
    errors,
  }
}

function renderMarkdown(
  results: readonly ProbeResult[],
  summaries: readonly ModelSummary[],
): string {
  const lines: string[] = []
  lines.push('# Ollama model probe results')
  lines.push('')
  lines.push(`Run at: ${new Date().toISOString()}`)
  lines.push(`Endpoint: ${CHAT_URL}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(
    '| Model | Chitchat false-positives (lower is better) | Tool-warranted correct | Avg latency | Errors |',
  )
  lines.push('|---|---|---|---|---|')
  for (const s of summaries) {
    lines.push(
      `| \`${s.model}\` | ${s.chitchatFalsePositives}/${s.chitchatTotal} | ${s.toolWarrantedCorrect}/${s.toolWarrantedTotal} | ${s.avgLatencyMs} ms | ${s.errors} |`,
    )
  }
  lines.push('')
  lines.push('## Per-probe detail')
  lines.push('')
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
  return lines.join('\n')
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
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
        category: 'chitchat',
        expectTools: [],
        toolNames: [],
        latencyMs: 0,
        textPreview: '',
        error: 'restart:web failed',
      }
      allResults.push(failure)
      summaries.push(summarize([failure]))
      continue
    }

    const modelResults: ProbeResult[] = []
    for (const probe of PROBES) {
      const result = await runProbe(model, probe)
      modelResults.push(result)
      const verdict = result.error
        ? `ERR ${result.error.slice(0, 60)}`
        : `tools: ${result.toolNames.join(',') || '-'}`
      process.stdout.write(
        `  ${probe.category.padEnd(15)} ${probe.slug.padEnd(20)} ${result.latencyMs.toString().padStart(6)}ms  ${verdict}\n`,
      )
    }
    allResults.push(...modelResults)
    summaries.push(summarize(modelResults))
  }

  const markdown = renderMarkdown(allResults, summaries)
  const outPath = join(OUT_DIR, 'smoke-results.md')
  await writeFile(outPath, `${markdown}\n`)
  process.stdout.write(`\n\nWrote ${outPath}\n\n`)
  process.stdout.write(markdown)
  process.stdout.write('\n')
}

await main()
