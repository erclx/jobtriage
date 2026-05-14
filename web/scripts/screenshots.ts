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
const SCREENSHOTS_ROOT = join(REPO_ROOT, '.claude', 'review', 'screenshots')
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'
const BASE_URL_HOSTNAME = new URL(BASE_URL).hostname
const IS_LOCALHOST =
  BASE_URL_HOSTNAME === 'localhost' || BASE_URL_HOSTNAME === '127.0.0.1'
const OUT_DIR = join(SCREENSHOTS_ROOT, BASE_URL_HOSTNAME)
const CHECK_CONSOLE_CLEAN =
  process.argv.includes('--check-console-clean') ||
  process.env.SMOKE_CONSOLE_CLEAN === '1'
const SCREENSHOT_FILTER = process.env.SCREENSHOT_FILTER?.trim() || null

interface ConsoleErrorEntry {
  readonly caseLabel: string
  readonly message: string
}

const consoleErrors: ConsoleErrorEntry[] = []

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
  readonly initScript?: string
  readonly act?: (page: Page) => Promise<void>
  readonly target?: (page: Page) => Promise<{
    readonly capture: () => Promise<Buffer>
  }>
}

const VOICE_INPUT_STUB = `
  class StubSpeechRecognition {
    start() {}
    stop() {}
    abort() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true }
  }
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    value: StubSpeechRecognition,
  })
`

const MOCK_CHIP_PROMPTS = [
  'Show me Stockholm AI engineering roles',
  'Find Stockholm nursing roles ranked against my profile',
  'Compare two top machine learning roles side by side',
  'Which AI roles are closing in the next two weeks',
] as const

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

const LONG_SAMPLE_PROFILE = `- Senior AI engineer with experience shipping production agents on Anthropic and OpenAI stacks at scale
- Based in Stockholm, open to hybrid roles in the Nordics within a forty-minute commute from the city centre
- Must-haves include meaningful equity, a senior IC track, and an engineering-led culture without product-design politics
- Deal-breakers are pure research roles, on-call rotations above one in six, and any role that demands relocation outside Sweden
- Strong preference for early-stage teams between fifteen and fifty engineers building developer-facing tools
- Open to staff-level positions when the scope is genuinely cross-team rather than nominal
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

function buildUrgentDeadlineCanvasState() {
  const base = buildPlaceAdsCanvasState()
  const urgentAd = {
    ...SAMPLE_ADS[0],
    days_until_deadline: 1,
    application_deadline: '2026-05-14',
  }
  return {
    ...base,
    adRegistry: { ...base.adRegistry, [SAMPLE_AD_IDS[0]]: urgentAd },
  }
}

function buildEmptyShortlistCanvasState() {
  return {
    ...buildPlaceAdsCanvasState(),
    view: 'shortlist',
    visibleAdIds: [],
    pinnedAdIds: [],
  }
}

function buildComparePairCanvasState() {
  const base = buildPlaceAdsCanvasState()
  return {
    ...base,
    view: 'compare',
    nodePositions: {},
    visibleAdIds: [SAMPLE_AD_IDS[0], SAMPLE_AD_IDS[1]],
    comparePair: {
      adIdA: SAMPLE_AD_IDS[0],
      adIdB: SAMPLE_AD_IDS[1],
      diffs: [
        {
          field: 'Employer',
          a: 'Acme AB',
          b: 'Beta Labs',
          verdict: 'neither',
        },
        {
          field: 'Location',
          a: 'Stockholm',
          b: 'Göteborg',
          verdict: 'a',
        },
        {
          field: 'Stack',
          a: 'Azure ML, Mastra',
          b: 'Sagemaker, Triton',
          verdict: 'neither',
        },
        {
          field: 'Seniority',
          a: 'Senior',
          b: 'Senior',
          verdict: 'same',
        },
      ],
    },
  }
}

function buildTimelineCanvasState() {
  const base = buildPlaceAdsCanvasState()
  const timelineAds = [
    { ...SAMPLE_ADS[0], days_until_deadline: 0 },
    { ...SAMPLE_ADS[1], days_until_deadline: 5 },
    { ...SAMPLE_ADS[2], days_until_deadline: 12 },
  ]
  const adRegistry = { ...base.adRegistry }
  for (const ad of timelineAds) adRegistry[ad.ad_id] = ad
  return {
    ...base,
    view: 'timeline',
    nodePositions: {},
    adRegistry,
    timeline: {
      todayCursor: '2026-05-14',
      adIds: SAMPLE_AD_IDS,
    },
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
    name: 'with-demo-onramp',
    seed: { localStorage: { theme: 'placeholder' } },
  },
  {
    surface: 'byok',
    name: 'switch-overlay-no-onramp',
    seed: {
      localStorage: { theme: 'placeholder' },
      sessionStorage: { 'jobtriage:provider': 'mock' },
    },
    act: async (page) => {
      await page.getByRole('button', { name: /switch provider/i }).click()
      await page.getByRole('button', { name: /^cancel/i }).waitFor()
    },
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
  ...(IS_LOCALHOST
    ? [
        {
          surface: 'byok' as const,
          name: 'ollama',
          seed: { localStorage: { theme: 'placeholder' } },
          act: async (page: Page) => {
            await page
              .getByRole('button', { name: /use local ollama/i })
              .focus()
          },
        },
      ]
    : []),
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
    name: 'mock-mode-empty',
    seed: {
      localStorage: { theme: 'placeholder' },
      sessionStorage: { 'jobtriage:provider': 'mock' },
    },
  },
  {
    surface: 'chat',
    name: 'mock-mode-mid',
    seed: {
      localStorage: { theme: 'placeholder' },
      sessionStorage: { 'jobtriage:provider': 'mock' },
    },
    act: async (page) => {
      await fireMockChip(page, MOCK_CHIP_PROMPTS[0])
      await fireMockChip(page, MOCK_CHIP_PROMPTS[1])
    },
  },
  {
    surface: 'chat',
    name: 'mock-mode-terminal',
    seed: {
      localStorage: { theme: 'placeholder' },
      sessionStorage: { 'jobtriage:provider': 'mock' },
    },
    act: async (page) => {
      for (const prompt of MOCK_CHIP_PROMPTS) {
        await fireMockChip(page, prompt)
      }
      await page
        .getByRole('button', { name: /switch to byok/i })
        .first()
        .waitFor()
    },
  },
  {
    // voice-input listening state is manual-only: the SpeechRecognition stub
    // required to drive onresult callbacks deterministically would run well
    // past a "few lines" of harness code. Verify the listening tint manually.
    surface: 'chat',
    name: 'voice-input-idle',
    seed: authedSeed(),
    initScript: VOICE_INPUT_STUB,
    act: async (page) => {
      await page.getByRole('button', { name: /start voice input/i }).waitFor()
    },
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
    name: 'compare-pair-with-diffs',
    seed: chatSeed(
      [
        userMessage('Compare the top two roles side by side.'),
        assistantMessage([
          SEARCH_TOOL_PART_OUTPUT,
          {
            type: 'tool-pairAdsForCompare',
            toolCallId: 'call-pair-1',
            state: 'output-available',
            input: {
              ad_id_a: SAMPLE_AD_IDS[0],
              ad_id_b: SAMPLE_AD_IDS[1],
              diffs: [
                {
                  field: 'Employer',
                  a: 'Acme AB',
                  b: 'Beta Labs',
                  verdict: 'neither',
                },
                {
                  field: 'Location',
                  a: 'Stockholm',
                  b: 'Göteborg',
                  verdict: 'a',
                },
                {
                  field: 'Stack',
                  a: 'Azure ML, Mastra',
                  b: 'Sagemaker, Triton',
                  verdict: 'neither',
                },
                {
                  field: 'Seniority',
                  a: 'Senior',
                  b: 'Senior',
                  verdict: 'same',
                },
              ],
            },
            output: { ok: true },
          },
          {
            type: 'text',
            text: 'Compare view is on the canvas with the diff table below.',
          },
        ]),
      ],
      buildComparePairCanvasState(),
    ),
  },
  {
    surface: 'canvas',
    name: 'timeline-with-axis',
    seed: chatSeed(
      [
        userMessage('Which AI roles close in the next two weeks?'),
        assistantMessage([
          SEARCH_TOOL_PART_OUTPUT,
          {
            type: 'tool-placeAdsOnTimeline',
            toolCallId: 'call-timeline-1',
            state: 'output-available',
            input: { ad_ids: SAMPLE_AD_IDS, today_cursor: '2026-05-14' },
            output: { ok: true },
          },
          {
            type: 'text',
            text: 'Three roles laid on the date axis with the closest deadline today.',
          },
        ]),
      ],
      buildTimelineCanvasState(),
    ),
  },
  {
    surface: 'canvas',
    name: 'matched-workspace',
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
    name: 'adnode-urgent',
    seed: chatSeed(
      [
        userMessage('Show me ads closing soon.'),
        assistantMessage([SEARCH_TOOL_PART_OUTPUT, PLACE_ADS_PART]),
      ],
      buildUrgentDeadlineCanvasState(),
    ),
    target: (page) => focusAdNode(page, SAMPLE_AD_IDS[0]),
  },
  {
    surface: 'canvas',
    name: 'shortlist-empty',
    seed: chatSeed(
      [
        userMessage('Show my shortlist.'),
        assistantMessage([
          { type: 'text', text: 'Switched to the shortlist view.' },
        ]),
      ],
      buildEmptyShortlistCanvasState(),
    ),
  },
  {
    surface: 'canvas',
    name: 'profile-node-expanded',
    seed: chatSeed([], {
      ...buildPlaceAdsCanvasState(),
      view: 'triage',
      visibleAdIds: [],
    }),
    initScript: `
      window.sessionStorage.setItem('jobtriage:profile-markdown', ${JSON.stringify(LONG_SAMPLE_PROFILE)});
    `,
    act: async (page) => {
      await page.getByTestId('profile-node-toggle').click()
      await page.getByText(/Show less/i).waitFor()
    },
    target: focusProfileNode,
  },
  {
    surface: 'profile',
    name: 'dialog-over-cap',
    seed: authedSeed(),
    act: async (page) => {
      await page
        .getByRole('button', { name: /edit profile/i })
        .first()
        .click()
      const textarea = page.getByRole('textbox')
      await textarea.waitFor()
      await textarea.evaluate((node, value) => {
        const input = node as HTMLTextAreaElement
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value',
        )?.set
        setter?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }, 'x'.repeat(20_001))
      await page.getByText(/over soft cap/i).waitFor()
    },
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
    surface: 'canvas',
    name: 'export-empty',
    seed: chatSeed(
      [
        userMessage('Find Stockholm AI roles.'),
        assistantMessage([SEARCH_TOOL_PART_OUTPUT, PLACE_ADS_PART]),
      ],
      buildPlaceAdsCanvasState(),
    ),
  },
  {
    surface: 'canvas',
    name: 'export-open',
    seed: chatSeed(
      [
        userMessage('Pin the Acme role and export.'),
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
    act: async (page) => {
      await page.getByRole('button', { name: 'Export shortlist' }).click()
    },
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

async function fireMockChip(page: Page, prompt: string): Promise<void> {
  await page.getByRole('button', { name: prompt, exact: true }).first().click()
  await page.waitForFunction(
    (expected: string) => {
      const raw = window.sessionStorage.getItem('jobtriage:chat-messages')
      if (!raw) return false
      try {
        const messages = JSON.parse(raw) as ReadonlyArray<{
          readonly role: string
          readonly parts: ReadonlyArray<{
            readonly type?: string
            readonly text?: string
          }>
        }>
        if (messages.length < 2) return false
        const last = messages[messages.length - 1]
        if (last.role !== 'assistant') return false
        const hasUserPrompt = messages.some(
          (message) =>
            message.role === 'user' &&
            message.parts.some(
              (part) => part.type === 'text' && part.text === expected,
            ),
        )
        return hasUserPrompt
      } catch {
        return false
      }
    },
    prompt,
    { timeout: 30_000 },
  )
}

async function focusAdNode(page: Page, adId: string) {
  const node = page.locator(`[data-testid="ad-node-${adId}"]`).first()
  await node.waitFor({ state: 'visible', timeout: 15_000 })
  return {
    capture: () => node.screenshot(),
  }
}

async function focusProfileNode(page: Page) {
  const node = page.locator(`[data-testid="profile-node"]`).first()
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
  if (testCase.initScript) {
    await context.addInitScript(testCase.initScript)
  }
  const page = await context.newPage()
  const caseLabel = `${testCase.surface}/${testCase.name}--${theme}`
  if (CHECK_CONSOLE_CLEAN) {
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push({ caseLabel, message: message.text() })
      }
    })
  }

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
    const hint = IS_LOCALHOST
      ? '\nStart the dev server with: bun run restart:web (from repo root)'
      : ''
    console.error(`Cannot reach ${BASE_URL}: ${message}${hint}`)
    process.exit(2)
  }
}

async function wipeOutDir(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })
}

async function main(): Promise<void> {
  await ensureServer()

  const cases = SCREENSHOT_FILTER
    ? CASES.filter((testCase) =>
        `${testCase.surface}/${testCase.name}`.includes(SCREENSHOT_FILTER),
      )
    : CASES

  if (SCREENSHOT_FILTER && cases.length === 0) {
    console.error(
      `No cases matched SCREENSHOT_FILTER=${SCREENSHOT_FILTER}. Available labels:\n${CASES.map((c) => `  ${c.surface}/${c.name}`).join('\n')}`,
    )
    process.exit(1)
  }

  if (SCREENSHOT_FILTER) {
    console.log(
      `Filtered to ${cases.length} case(s) matching "${SCREENSHOT_FILTER}". Skipping output-dir wipe.`,
    )
  } else {
    await wipeOutDir()
  }

  const browser = await chromium.launch()
  const themes: readonly Theme[] = ['light', 'dark']
  try {
    for (const testCase of cases) {
      for (const theme of themes) {
        await captureOne(browser, testCase, theme)
      }
    }
  } finally {
    await browser.close()
  }
  console.log(`\nWrote screenshots to ${OUT_DIR}`)

  if (CHECK_CONSOLE_CLEAN && consoleErrors.length > 0) {
    console.error(`\n✘ ${consoleErrors.length} console error(s) detected:`)
    for (const entry of consoleErrors) {
      console.error(`  ${entry.caseLabel}: ${entry.message}`)
    }
    process.exit(1)
  }
}

void main()
