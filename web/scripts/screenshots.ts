import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from '@playwright/test'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..', '..')
const OUT_DIR = join(REPO_ROOT, '.claude', 'review', 'screenshots')
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'

type Theme = 'light' | 'dark'
type Surface = 'byok' | 'profile' | 'chat' | 'canvas'

interface SeedPayload {
  readonly localStorage?: Record<string, string>
  readonly sessionStorage?: Record<string, string>
}

interface Viewport {
  readonly width: number
  readonly height: number
}

const DEFAULT_VIEWPORT: Viewport = { width: 1440, height: 900 }
const MOBILE_VIEWPORT: Viewport = { width: 375, height: 812 }
const TABLET_VIEWPORT: Viewport = { width: 768, height: 1024 }

interface CaptureCase {
  readonly surface: Surface
  readonly name: string
  readonly seed: SeedPayload
  readonly viewport?: Viewport
  readonly act?: (page: Page) => Promise<void>
  readonly target?: (page: Page) => Promise<{
    readonly capture: () => Promise<Buffer>
  }>
}

const SAMPLE_KEY = 'sk-ant-api03-screenshot-harness-fixture'

const SAMPLE_PROFILE = `## Role
Senior AI engineer

## Must-haves
Stockholm or remote-Sweden, agentic systems, RAG, hybrid retrieval

## Nice to have
LangGraph, Mastra, Azure ML

## Deal-breakers
On-site five days a week
`

const SAMPLE_ADS = [
  {
    ad_id: '30966965',
    headline: 'Senior AI Engineer',
    employer_name: 'Acme AB',
    municipality: 'Stockholm',
    application_deadline: '2026-05-21',
    webpage_url: 'https://example.invalid/30966965',
    description_excerpt:
      'Build agentic systems on Azure ML with Mastra and LangGraph. Hybrid retrieval over a multilingual ad corpus.',
    occupation_label: 'Mjukvaruutvecklare',
  },
  {
    ad_id: '30912001',
    headline: 'Principal ML Platform Engineer',
    employer_name: 'Beta Labs',
    municipality: 'Göteborg',
    application_deadline: '2026-05-30',
    webpage_url: 'https://example.invalid/30912001',
    description_excerpt:
      'Lead ML platform work across batch, streaming, and agent runtimes. RAG, evals, and on-call rotation.',
    occupation_label: 'Systemarkitekt',
  },
  {
    ad_id: '30887443',
    headline: 'Applied AI Researcher',
    employer_name: 'Gamma Group',
    municipality: 'Stockholm',
    application_deadline: '2026-06-12',
    webpage_url: 'https://example.invalid/30887443',
    description_excerpt:
      'Applied research on retrieval, ranking, and reranking for Swedish-language corpora. Cross-encoder ablations welcome.',
    occupation_label: 'Forskare',
  },
] as const

const SAMPLE_AD_IDS = SAMPLE_ADS.map((ad) => ad.ad_id)

const ASSISTANT_MESSAGE_ID = 'assistant-fixture'
const USER_MESSAGE_ID = 'user-fixture'

function userMessage(text: string) {
  return {
    id: USER_MESSAGE_ID,
    role: 'user' as const,
    parts: [{ type: 'text', text }],
  }
}

function assistantMessage(parts: readonly unknown[]) {
  return {
    id: ASSISTANT_MESSAGE_ID,
    role: 'assistant' as const,
    parts,
  }
}

function buildPlaceAdsCanvasState() {
  const adRegistry: Record<string, unknown> = {}
  for (const ad of SAMPLE_ADS) adRegistry[ad.ad_id] = ad
  return {
    view: 'triage',
    adRegistry,
    nodePositions: {
      [SAMPLE_AD_IDS[0]]: { x: 320, y: 80 },
      [SAMPLE_AD_IDS[1]]: { x: 640, y: 80 },
      [SAMPLE_AD_IDS[2]]: { x: 960, y: 80 },
    },
    visibleAdIds: SAMPLE_AD_IDS,
    groups: [],
    emphasis: 'none',
    profileMatches: [],
    comparePair: null,
    timeline: null,
    pinnedAdIds: [],
    statuses: {},
    appliedToolCallIds: ['fixture-place-ads'],
  }
}

function buildMatchedCanvasState() {
  return {
    ...buildPlaceAdsCanvasState(),
    emphasis: 'matchScore',
    profileMatches: [
      {
        adId: SAMPLE_AD_IDS[0],
        score: 0.78,
        rationale: 'Stockholm plus Azure ML plus Mastra',
      },
      {
        adId: SAMPLE_AD_IDS[1],
        score: 0.62,
        rationale: 'RAG plus evals, location stretch',
      },
      {
        adId: SAMPLE_AD_IDS[2],
        score: 0.55,
        rationale: 'Applied retrieval research overlap',
      },
    ],
  }
}

function buildPinnedCanvasState() {
  return {
    ...buildPlaceAdsCanvasState(),
    pinnedAdIds: [SAMPLE_AD_IDS[0]],
  }
}

const SEARCH_TOOL_PART_OUTPUT = {
  type: 'tool-searchJobs',
  toolCallId: 'call-search-1',
  state: 'output-available',
  input: { occupation_concept_id: 'X9jv_K2b_m48', region: 'Stockholms län' },
  output: { results: SAMPLE_ADS },
}

const SEARCH_TOOL_PART_ERROR = {
  type: 'tool-searchJobs',
  toolCallId: 'call-search-err',
  state: 'output-error',
  input: { occupation_concept_id: 'occupation-12345' },
  errorText:
    'occupation_concept_id must follow the JobTech taxonomy format (4-3-3 alphanumeric, underscore-separated)',
}

const TRACK_STATUS_EMPTY = {
  type: 'tool-trackStatus',
  toolCallId: 'call-status-empty',
  state: 'output-available',
  input: { ad_id: '30966965' },
  output: { ad_id: '30966965', entries: [] },
}

const TRACK_STATUS_FILLED = {
  type: 'tool-trackStatus',
  toolCallId: 'call-status-filled',
  state: 'output-available',
  input: { ad_id: '30966965' },
  output: {
    ad_id: '30966965',
    entries: [
      {
        recorded_on: '2026-04-30',
        status: 'applied',
        note: 'Reached out via referral, link shared',
      },
      { recorded_on: '2026-04-15', status: 'shortlisted', note: '' },
    ],
  },
}

const PLACE_ADS_PART = {
  type: 'tool-placeAds',
  toolCallId: 'call-place-ads-1',
  state: 'output-available',
  input: { ad_ids: SAMPLE_AD_IDS, layout: 'grid' },
  output: { ok: true },
}

function authedSeed(extra: SeedPayload = {}): SeedPayload {
  return {
    localStorage: {
      theme: 'placeholder',
      ...extra.localStorage,
    },
    sessionStorage: {
      'jobtriage:provider': 'anthropic',
      'jobtriage:anthropic-api-key': SAMPLE_KEY,
      ...extra.sessionStorage,
    },
  }
}

function chatSeed(messages: readonly unknown[], canvas?: unknown): SeedPayload {
  const session: Record<string, string> = {
    'jobtriage:chat-messages': JSON.stringify(messages),
  }
  if (canvas) session['jobtriage:canvas-state'] = JSON.stringify(canvas)
  return authedSeed({ sessionStorage: session })
}

const CASES: readonly CaptureCase[] = [
  {
    surface: 'byok',
    name: 'empty',
    seed: { localStorage: { theme: 'placeholder' } },
  },
  {
    surface: 'byok',
    name: 'filled',
    seed: { localStorage: { theme: 'placeholder' } },
    act: async (page) => {
      await page.getByLabel('Anthropic API key').fill(SAMPLE_KEY)
      await page.getByLabel('Anthropic API key').blur()
    },
  },
  {
    surface: 'byok',
    name: 'ollama',
    seed: { localStorage: { theme: 'placeholder' } },
    act: async (page) => {
      await page.getByRole('button', { name: /use local ollama/i }).focus()
    },
  },
  {
    surface: 'byok',
    name: 'openai',
    seed: { localStorage: { theme: 'placeholder' } },
    act: async (page) => {
      await page.getByText('OpenAI', { exact: true }).click()
    },
  },
  {
    surface: 'byok',
    name: 'gemini',
    seed: { localStorage: { theme: 'placeholder' } },
    act: async (page) => {
      await page.getByText('Gemini', { exact: true }).click()
    },
  },
  {
    surface: 'profile',
    name: 'empty',
    seed: authedSeed(),
    act: async (page) => {
      await page.getByRole('button', { name: /edit profile/i }).click()
      await page.getByRole('dialog').waitFor()
    },
  },
  {
    surface: 'profile',
    name: 'populated',
    seed: authedSeed({
      sessionStorage: { 'jobtriage:profile-markdown': SAMPLE_PROFILE },
    }),
    act: async (page) => {
      await page.getByRole('button', { name: /edit profile/i }).click()
      await page.getByRole('dialog').waitFor()
    },
  },
  {
    surface: 'profile',
    name: 'save-pending',
    seed: authedSeed({
      sessionStorage: { 'jobtriage:profile-markdown': SAMPLE_PROFILE },
    }),
    act: async (page) => {
      await page.getByRole('button', { name: /edit profile/i }).click()
      await page.getByRole('dialog').waitFor()
      const textarea = page.getByRole('textbox')
      await textarea.click()
      await textarea.press('End')
      await textarea.type('\n## Updated\nAdded after save')
      await page.getByText(/unsaved changes/i).waitFor()
    },
  },
  {
    surface: 'chat',
    name: 'empty-workspace',
    seed: authedSeed(),
  },
  {
    surface: 'chat',
    name: 'trace-collapsed',
    seed: chatSeed([
      userMessage('Find Stockholm AI roles that mention agentic systems.'),
      assistantMessage([
        SEARCH_TOOL_PART_OUTPUT,
        PLACE_ADS_PART,
        {
          type: 'text',
          text: 'Three roles look strong, two are stretches. See the canvas.',
        },
      ]),
    ]),
  },
  {
    surface: 'chat',
    name: 'trace-expanded',
    seed: chatSeed([
      userMessage('Find Stockholm AI roles that mention agentic systems.'),
      assistantMessage([
        SEARCH_TOOL_PART_OUTPUT,
        PLACE_ADS_PART,
        {
          type: 'text',
          text: 'Three roles look strong, two are stretches. See the canvas.',
        },
      ]),
    ]),
    act: async (page) => {
      await page
        .getByRole('button', { name: /searched jobtech filter/i })
        .first()
        .click()
    },
  },
  {
    surface: 'chat',
    name: 'tool-error',
    seed: chatSeed([
      userMessage('Find roles for occupation-12345 in Stockholm.'),
      assistantMessage([
        SEARCH_TOOL_PART_ERROR,
        {
          type: 'text',
          text: 'That id is not a JobTech taxonomy id. Want me to search by region instead?',
        },
      ]),
    ]),
  },
  {
    surface: 'chat',
    name: 'engagement-empty',
    seed: chatSeed([
      userMessage('Did I apply to ad 30966965?'),
      assistantMessage([
        TRACK_STATUS_EMPTY,
        { type: 'text', text: 'Nothing tracked for that ad yet.' },
      ]),
    ]),
  },
  {
    surface: 'chat',
    name: 'engagement-filled',
    seed: chatSeed([
      userMessage('Did I apply to ad 30966965?'),
      assistantMessage([
        TRACK_STATUS_FILLED,
        {
          type: 'text',
          text: 'You applied on 2026-04-30 after a referral.',
        },
      ]),
    ]),
  },
  {
    surface: 'canvas',
    name: 'populated',
    seed: chatSeed(
      [
        userMessage('Find Stockholm AI roles that mention agentic systems.'),
        assistantMessage([
          SEARCH_TOOL_PART_OUTPUT,
          PLACE_ADS_PART,
          {
            type: 'text',
            text: 'Three roles look strong, two are stretches. See the canvas.',
          },
        ]),
      ],
      buildPlaceAdsCanvasState(),
    ),
  },
  {
    surface: 'canvas',
    name: 'adnode-default',
    seed: chatSeed(
      [
        userMessage('Find Stockholm AI roles.'),
        assistantMessage([SEARCH_TOOL_PART_OUTPUT, PLACE_ADS_PART]),
      ],
      buildPlaceAdsCanvasState(),
    ),
    target: (page) => focusAdNode(page, SAMPLE_AD_IDS[0]),
  },
  {
    surface: 'canvas',
    name: 'adnode-matched',
    seed: chatSeed(
      [
        userMessage('Match my profile against these.'),
        assistantMessage([
          SEARCH_TOOL_PART_OUTPUT,
          PLACE_ADS_PART,
          {
            type: 'tool-connectProfileToAds',
            toolCallId: 'call-connect-1',
            state: 'output-available',
            input: { ad_ids: SAMPLE_AD_IDS },
            output: { ok: true },
          },
        ]),
      ],
      buildMatchedCanvasState(),
    ),
    target: (page) => focusAdNode(page, SAMPLE_AD_IDS[0]),
  },
  {
    surface: 'canvas',
    name: 'adnode-pinned',
    seed: chatSeed(
      [
        userMessage('Pin the Acme role.'),
        assistantMessage([
          SEARCH_TOOL_PART_OUTPUT,
          PLACE_ADS_PART,
          {
            type: 'tool-pinToShortlist',
            toolCallId: 'call-pin-1',
            state: 'output-available',
            input: { ad_id: SAMPLE_AD_IDS[0] },
            output: { ok: true },
          },
        ]),
      ],
      buildPinnedCanvasState(),
    ),
    target: (page) => focusAdNode(page, SAMPLE_AD_IDS[0]),
  },
  {
    surface: 'byok',
    name: 'mobile-375',
    viewport: MOBILE_VIEWPORT,
    seed: { localStorage: { theme: 'placeholder' } },
  },
  {
    surface: 'byok',
    name: 'mobile-768',
    viewport: TABLET_VIEWPORT,
    seed: { localStorage: { theme: 'placeholder' } },
  },
  {
    surface: 'chat',
    name: 'mobile-375',
    viewport: MOBILE_VIEWPORT,
    seed: authedSeed(),
  },
  {
    surface: 'chat',
    name: 'mobile-768',
    viewport: TABLET_VIEWPORT,
    seed: authedSeed(),
  },
] as const

async function focusAdNode(page: Page, adId: string) {
  const node = page.locator(`[data-testid="ad-node-${adId}"]`).first()
  await node.waitFor({ state: 'visible', timeout: 15_000 })
  return {
    capture: () => node.screenshot(),
  }
}

async function applySeed(
  context: BrowserContext,
  theme: Theme,
  seed: SeedPayload,
) {
  const merged: SeedPayload = {
    localStorage: { ...seed.localStorage, theme },
    sessionStorage: { ...seed.sessionStorage },
  }
  await context.addInitScript((payload: SeedPayload) => {
    const local = payload.localStorage ?? {}
    for (const [key, value] of Object.entries(local)) {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* ignore */
      }
    }
    const session = payload.sessionStorage ?? {}
    for (const [key, value] of Object.entries(session)) {
      try {
        window.sessionStorage.setItem(key, value)
      } catch {
        /* ignore */
      }
    }
  }, merged)
}

async function captureOne(
  browser: Browser,
  testCase: CaptureCase,
  theme: Theme,
): Promise<void> {
  const context = await browser.newContext({
    viewport: testCase.viewport ?? DEFAULT_VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: theme,
  })
  await applySeed(context, theme, testCase.seed)
  const page = await context.newPage()

  try {
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    })
    await page
      .waitForLoadState('networkidle', { timeout: 10_000 })
      .catch(() => {})

    if (testCase.act) {
      await testCase.act(page)
      await page.waitForTimeout(200)
    }

    const outDir = join(OUT_DIR, testCase.surface)
    await mkdir(outDir, { recursive: true })
    const outPath = join(outDir, `${testCase.name}--${theme}.png`)

    if (testCase.target) {
      const target = await testCase.target(page)
      const buffer = await target.capture()
      const { writeFile } = await import('node:fs/promises')
      await writeFile(outPath, buffer)
    } else {
      await page.screenshot({ path: outPath, fullPage: false })
    }
    console.log(`✔ ${testCase.surface}/${testCase.name}--${theme}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `✘ ${testCase.surface}/${testCase.name}--${theme}: ${message}`,
    )
  } finally {
    await context.close()
  }
}

async function ensureServer(): Promise<void> {
  try {
    const response = await fetch(BASE_URL, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok && response.status >= 500) {
      throw new Error(`status ${response.status}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `Cannot reach ${BASE_URL}: ${message}\nStart the dev server with: bun run restart:web (from repo root)`,
    )
    process.exit(2)
  }
}

async function main(): Promise<void> {
  await ensureServer()
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const themes: readonly Theme[] = ['light', 'dark']
  try {
    for (const testCase of CASES) {
      for (const theme of themes) {
        await captureOne(browser, testCase, theme)
      }
    }
  } finally {
    await browser.close()
  }
  console.log(`\nWrote screenshots to ${OUT_DIR}`)
}

void main()
