import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { type Browser, chromium } from '@playwright/test'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..', '..')

const OUT_DIR =
  process.env.AUDIT_OUT_DIR ?? join(REPO_ROOT, '.claude', 'review', 'audit')
const BASE_URL = process.env.AUDIT_BASE_URL ?? 'http://localhost:3000'
const PROMPT_TIMEOUT_MS = Number(
  process.env.AUDIT_PROMPT_TIMEOUT_MS ?? '900000',
)

const MOCK_PROFILE = `# Profile
- Senior AI engineer, 8 years TypeScript, 4 years Python.
- Based in Stockholm; open to remote-Sweden roles.
- Strengths: agentic systems, RAG, hybrid retrieval, LangGraph, Mastra, Azure ML.
- Looking for: senior or principal IC roles at AI startups or applied AI teams.`

interface PromptCase {
  readonly slug: string
  readonly prompt: string
}

const CASES: readonly PromptCase[] = [
  {
    slug: 'single-tool-explicit',
    prompt: 'Use deadlineWatch to list ads expiring in the next 14 days.',
  },
  {
    slug: 'chain-explicit',
    prompt:
      'First triageBatch on agentic systems with top_k 5, then matchProfile on the top result.',
  },
  {
    slug: 'retrieval-open',
    prompt:
      'Find me Stockholm AI engineering roles that mention agentic systems.',
  },
  {
    slug: 'comparison-open',
    prompt: 'Compare the two most relevant Mastra and LangGraph roles.',
  },
  {
    slug: 'deadline-phrasing',
    prompt: 'Which roles are expiring this month?',
  },
  {
    slug: 'status-phrasing',
    prompt: 'Did I apply to ad 30966965?',
  },
  {
    slug: 'swedish-phrasing',
    prompt:
      'Vilka annonser om agentiska system har deadline före månadsslutet?',
  },
  {
    slug: 'adversarial-empty',
    prompt: 'Find roles for a quantum welding theologian in Kiruna.',
  },
]

async function runOne(browser: Browser, testCase: PromptCase): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1600 },
  })
  await context.addInitScript((profile: string) => {
    window.sessionStorage.setItem('jobtriage:provider', 'ollama')
    window.sessionStorage.setItem('jobtriage:profile-markdown', profile)
  }, MOCK_PROFILE)
  const page = await context.newPage()

  const sseChunks: string[] = []
  let resolveDone: () => void = () => {}
  let rejectDone: (err: Error) => void = () => {}
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })

  await page.route('**/api/chat', async (route) => {
    try {
      const response = await route.fetch({ timeout: PROMPT_TIMEOUT_MS })
      const body = await response.text()
      sseChunks.push(body)
      await route.fulfill({ response, body })
      resolveDone()
    } catch (err) {
      rejectDone(err instanceof Error ? err : new Error(String(err)))
    }
  })

  console.log(`[${testCase.slug}] navigating to ${BASE_URL}`)
  await page.goto(BASE_URL, { waitUntil: 'load' })

  const textarea = page.getByPlaceholder(/Ask about Swedish job ads/i)
  await textarea.waitFor({ state: 'visible', timeout: 30_000 })
  await textarea.fill(testCase.prompt)
  await textarea.press('Enter')

  const startedAt = Date.now()
  console.log(`[${testCase.slug}] submitted; waiting for stream`)
  await Promise.race([
    done,
    new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error(`stream timeout ${PROMPT_TIMEOUT_MS}ms`)),
        PROMPT_TIMEOUT_MS,
      ),
    ),
  ])
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
  console.log(`[${testCase.slug}] stream completed in ${elapsedSeconds}s`)

  await page.waitForTimeout(2500)
  await page.screenshot({
    path: join(OUT_DIR, `${testCase.slug}.png`),
    fullPage: true,
  })
  await writeFile(
    join(OUT_DIR, `${testCase.slug}.sse.txt`),
    sseChunks.join('\n---next-response---\n'),
    'utf8',
  )

  await context.close()
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const testCase of CASES) {
      console.log(`\n=== ${testCase.slug} ===`)
      try {
        await runOne(browser, testCase)
      } catch (err) {
        const message =
          err instanceof Error
            ? `${err.message}\n${err.stack ?? ''}`
            : String(err)
        console.error(`[${testCase.slug}] failed: ${message}`)
        await writeFile(
          join(OUT_DIR, `${testCase.slug}.error.txt`),
          message,
          'utf8',
        )
      }
    }
  } finally {
    await browser.close()
  }
}

void main()
