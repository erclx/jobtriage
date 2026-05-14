/**
 * Capture mock-mode demo fixtures from live JobTech (Platsbanken).
 *
 * Run once when the canned ads expire. Emits four TS modules under
 * `web/src/features/mock/scripts/`, each one a typed MockScript that the
 * mock provider replays for a no-key visitor.
 *
 * Usage:
 *   bun run web/scripts/capture-mock-fixtures.ts
 *
 * Hits `https://jobsearch.api.jobtechdev.se` and
 * `https://taxonomy.api.jobtechdev.se` directly. Mirrors the mapping
 * `python/src/jobtriage/api/routers/jobs.py:_ad_to_live_summary` so the
 * shape matches what the deploy posture returns at runtime.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  AI_ENGINEER_PROFILE,
  NURSE_PROFILE,
} from '../src/features/mock/profiles'
import type { MockScript, MockStep } from '../src/features/mock/scripts/types'

const JOBTECH_SEARCH_URL = 'https://jobsearch.api.jobtechdev.se/search'
const JOBTECH_AD_URL = 'https://jobsearch.api.jobtechdev.se/ad'
const JOBTECH_TAXONOMY_URL =
  'https://taxonomy.api.jobtechdev.se/v1/taxonomy/suggesters/autocomplete'
const EXCERPT_MAX_CHARS = 480

interface JobtechAd {
  readonly id: string
  readonly headline: string
  readonly description?: { readonly text?: string | null }
  readonly application_deadline?: string | null
  readonly webpage_url?: string | null
  readonly employer?: { readonly name?: string | null } | null
  readonly workplace_address?: { readonly municipality?: string | null } | null
  readonly occupation?: { readonly label?: string | null } | null
}

interface JobtechSearchResponse {
  readonly hits: readonly JobtechAd[]
}

interface LiveAdSummary {
  readonly ad_id: string
  readonly headline: string
  readonly employer_name: string | null
  readonly municipality: string | null
  readonly application_deadline: string | null
  readonly webpage_url: string | null
  readonly description_excerpt: string
  readonly occupation_label: string | null
}

interface DeadlineAdSummary extends Omit<
  LiveAdSummary,
  'description_excerpt' | 'occupation_label'
> {
  readonly days_until_deadline: number
}

interface JobtechConcept {
  readonly 'taxonomy/id'?: string
  readonly 'taxonomy/preferred-label'?: string
}

interface ConceptResult {
  readonly concept_id: string
  readonly preferred_label: string
  readonly type: 'occupation' | 'region'
}

const ALIVE_CHECK_TIMEOUT_MS = 8_000

async function isAdAlive(adId: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ALIVE_CHECK_TIMEOUT_MS)
  try {
    const response = await fetch(`${JOBTECH_AD_URL}/${adId}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (response.status === 200) return true
    if (response.status === 404) return false
    throw new Error(
      `JobTech ad-details returned unexpected status ${response.status} for ad ${adId}`,
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function dropDeadAds<T extends { readonly ad_id: string }>(
  fixtureSlug: string,
  ads: readonly T[],
): Promise<readonly T[]> {
  const verdicts = await Promise.all(ads.map((ad) => isAdAlive(ad.ad_id)))
  const alive = ads.filter((_, index) => verdicts[index])
  const dropped = ads.length - alive.length
  if (dropped > 0) {
    console.log(`Fixture ${fixtureSlug}: dropped ${dropped} dead ad(s)`)
  }
  return alive
}

function clipExcerpt(text: string | null | undefined): string {
  if (!text) return ''
  const cleaned = text.split(/\s+/).filter(Boolean).join(' ')
  if (cleaned.length <= EXCERPT_MAX_CHARS) return cleaned
  return `${cleaned.slice(0, EXCERPT_MAX_CHARS).trimEnd()}…`
}

function toLiveSummary(ad: JobtechAd): LiveAdSummary {
  return {
    ad_id: ad.id,
    headline: ad.headline,
    employer_name: ad.employer?.name ?? null,
    municipality: ad.workplace_address?.municipality ?? null,
    application_deadline: ad.application_deadline ?? null,
    webpage_url: ad.webpage_url ?? null,
    description_excerpt: clipExcerpt(ad.description?.text ?? null),
    occupation_label: ad.occupation?.label ?? null,
  }
}

function daysUntil(isoDeadline: string | null): number {
  if (!isoDeadline) return 365
  const deadline = new Date(isoDeadline)
  const today = new Date()
  const diffMs = deadline.getTime() - today.getTime()
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
}

async function liveSearch(
  query: string | undefined,
  occupationConceptId: string | undefined,
  region: string | undefined,
  limit: number,
): Promise<readonly LiveAdSummary[]> {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', '0')
  if (query) params.set('q', query)
  if (occupationConceptId) params.set('occupation-name', occupationConceptId)
  if (region) params.set('region', region)

  const response = await fetch(`${JOBTECH_SEARCH_URL}?${params.toString()}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`JobTech search failed: ${response.status}`)
  }
  const payload = (await response.json()) as JobtechSearchResponse
  return payload.hits.map(toLiveSummary)
}

async function lookupConcept(
  query: string,
  kind: 'occupation' | 'region',
  limit: number,
): Promise<readonly ConceptResult[]> {
  const taxonomyType = kind === 'occupation' ? 'occupation-name' : 'region'
  const params = new URLSearchParams({
    'query-string': query,
    offset: '0',
    limit: String(limit),
    type: taxonomyType,
  })
  const url = `${JOBTECH_TAXONOMY_URL}?${params.toString()}`
  const backoffMs = [0, 5_000, 15_000]
  let lastError: unknown = null
  for (const wait of backoffMs) {
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        lastError = new Error(`JobTech taxonomy failed: ${response.status}`)
        continue
      }
      const payload = (await response.json()) as readonly JobtechConcept[]
      return payload
        .map((item) => ({
          concept_id: item['taxonomy/id'] ?? '',
          preferred_label: item['taxonomy/preferred-label'] ?? '',
          type: kind,
        }))
        .filter(
          (entry) => entry.concept_id && entry.preferred_label,
        ) as ConceptResult[]
    } catch (error) {
      lastError = error
    }
  }
  console.warn(
    `lookupConcept(${kind}, "${query}") falling back to empty concepts: ${String(lastError)}`,
  )
  return []
}

function callId(slug: string, index: number): string {
  return `mock-${slug}-call-${index}`
}

function joinTopAds(ads: readonly LiveAdSummary[]): string {
  return ads
    .slice(0, 3)
    .map(
      (ad) =>
        `${ad.headline.trim()} at ${ad.employer_name ?? 'an unnamed employer'}`,
    )
    .join(', ')
}

async function buildStockholmAiEngineering(): Promise<MockScript> {
  const slug = 'sthlm-ai'
  const concepts = [
    ...(await lookupConcept('AI engineer', 'occupation', 3)),
    ...(await lookupConcept('Stockholm', 'region', 3)),
  ]
  const rawAds = (
    await liveSearch('AI engineer', undefined, undefined, 5)
  ).slice(0, 5)
  const ads = await dropDeadAds(slug, rawAds)
  if (ads.length < 3)
    throw new Error('Expected at least 3 ads for Stockholm AI engineering')

  const adIds = ads.map((ad) => ad.ad_id)
  const topAds = joinTopAds(ads)

  const steps: MockStep[] = [
    {
      kind: 'text',
      content:
        'Looking up the JobTech taxonomy for AI engineering and Stockholm so the search query uses real concept ids.',
    },
    {
      kind: 'tool',
      toolName: 'lookupConcept',
      toolCallId: callId(slug, 1),
      input: { query: 'AI engineer Stockholm', top_k: 6 },
      output: { results: concepts },
    },
    {
      kind: 'text',
      content:
        ' Now searching live JobTech ads for AI engineering roles based in Stockholm.',
    },
    {
      kind: 'tool',
      toolName: 'searchJobs',
      toolCallId: callId(slug, 2),
      input: { query: 'AI engineer', top_k: 5 },
      output: { results: ads },
    },
    {
      kind: 'tool',
      toolName: 'placeAds',
      toolCallId: callId(slug, 3),
      input: { ad_ids: adIds, layout: 'grid', emphasis: 'none' },
      output: {
        accepted: true,
        ad_ids: adIds,
        layout: 'grid',
        emphasis: 'none',
      },
    },
    {
      kind: 'text',
      content: ` Found ${ads.length} active roles. The strongest signal comes from ${topAds}. Cards are on the canvas to the right. Click any card to expand the description.`,
    },
  ]

  return {
    prompt: 'Show me Stockholm AI engineering roles',
    chipLabel: 'Show me Stockholm AI engineering roles',
    messageId: 'mock-message-sthlm-ai',
    profile: AI_ENGINEER_PROFILE,
    steps,
  }
}

async function buildStockholmNursing(): Promise<MockScript> {
  const slug = 'sthlm-nursing'
  const occupationConcepts = await lookupConcept(
    'sjuksköterska',
    'occupation',
    5,
  )
  const regionConcepts = await lookupConcept('Stockholm', 'region', 3)
  const concepts = [...occupationConcepts, ...regionConcepts]
  const rawAds = (
    await liveSearch('sjuksköterska Stockholm', undefined, undefined, 5)
  ).slice(0, 5)
  const ads = await dropDeadAds(slug, rawAds)
  if (ads.length < 3)
    throw new Error('Expected at least 3 ads for Stockholm nursing')

  const adIds = ads.map((ad) => ad.ad_id)
  const strongIds = adIds.slice(0, 2)
  const considerIds = adIds.slice(2, 4)
  const passIds = adIds.slice(4)
  const groups = [
    { label: 'Strong fit', ad_ids: strongIds },
    ...(considerIds.length > 0
      ? [{ label: 'Consider', ad_ids: considerIds }]
      : []),
    ...(passIds.length > 0 ? [{ label: 'Worth a look', ad_ids: passIds }] : []),
  ]
  const links = ads.slice(0, Math.min(ads.length, 4)).map((ad, index) => ({
    ad_id: ad.ad_id,
    score: Math.max(0.4, 0.92 - index * 0.12),
    rationale:
      index === 0
        ? 'Cardiology specialist scope aligns with the profile training.'
        : index === 1
          ? 'Acute-ward responsibility matches the experience in the profile.'
          : 'Generalist nursing role that the profile experience covers.',
  }))

  const steps: MockStep[] = [
    {
      kind: 'text',
      content:
        'Resolving "nurse" and "Stockholm" against the JobTech taxonomy so the search hits the right occupation family.',
    },
    {
      kind: 'tool',
      toolName: 'lookupConcept',
      toolCallId: callId(slug, 1),
      input: { query: 'sjuksköterska Stockholm', top_k: 8 },
      output: { results: concepts },
    },
    {
      kind: 'text',
      content: ' Searching live nursing roles in the Stockholm region.',
    },
    {
      kind: 'tool',
      toolName: 'searchJobs',
      toolCallId: callId(slug, 2),
      input: { query: 'sjuksköterska Stockholm', top_k: 5 },
      output: { results: ads },
    },
    {
      kind: 'tool',
      toolName: 'groupAds',
      toolCallId: callId(slug, 3),
      input: { groups },
      output: { accepted: true, groups },
    },
    {
      kind: 'tool',
      toolName: 'connectProfileToAds',
      toolCallId: callId(slug, 4),
      input: { links },
      output: { accepted: true, links },
    },
    {
      kind: 'text',
      content: ` Grouped ${ads.length} roles by fit and drew weighted edges from the saved profile. The strong-fit tier carries the highest match scores. Each edge from the profile node carries a one-line rationale.`,
    },
  ]

  return {
    prompt: 'Find Stockholm nursing roles ranked against my profile',
    chipLabel: 'Find Stockholm nursing roles ranked against my profile',
    messageId: 'mock-message-sthlm-nursing',
    profile: NURSE_PROFILE,
    steps,
  }
}

async function buildCompareThreeRoles(): Promise<MockScript> {
  const slug = 'compare-roles'
  const rawAds = (
    await liveSearch('machine learning engineer', undefined, undefined, 5)
  ).slice(0, 3)
  const ads = await dropDeadAds(slug, rawAds)
  if (ads.length < 2) throw new Error('Expected at least 2 ads for compare')
  const [a, b, c] = ads
  const compareIds = [a.ad_id, b.ad_id]

  const diffs = [
    {
      field: 'Employer',
      a: a.employer_name ?? 'Unknown',
      b: b.employer_name ?? 'Unknown',
      verdict: 'neither' as const,
    },
    {
      field: 'Location',
      a: a.municipality ?? '—',
      b: b.municipality ?? '—',
      verdict: 'neither' as const,
    },
    {
      field: 'Deadline',
      a: a.application_deadline?.slice(0, 10) ?? 'open-ended',
      b: b.application_deadline?.slice(0, 10) ?? 'open-ended',
      verdict:
        a.application_deadline && b.application_deadline
          ? a.application_deadline < b.application_deadline
            ? ('b' as const)
            : ('a' as const)
          : ('same' as const),
    },
  ]

  const steps: MockStep[] = [
    {
      kind: 'text',
      content:
        'Pulling a fresh batch of machine learning engineer roles so the comparison has live candidates.',
    },
    {
      kind: 'tool',
      toolName: 'searchJobs',
      toolCallId: callId(slug, 1),
      input: { query: 'machine learning engineer', top_k: 5 },
      output: { results: ads },
    },
    {
      kind: 'text',
      content: ` Comparing the two strongest candidates. The first is ${a.headline.trim()} and the second is ${b.headline.trim()}.`,
    },
    {
      kind: 'tool',
      toolName: 'compareRoles',
      toolCallId: callId(slug, 2),
      input: { ad_ids: compareIds },
      output: { results: [a, b] },
    },
    {
      kind: 'tool',
      toolName: 'pairAdsForCompare',
      toolCallId: callId(slug, 3),
      input: { ad_id_a: a.ad_id, ad_id_b: b.ad_id, diffs },
      output: { accepted: true, ad_id_a: a.ad_id, ad_id_b: b.ad_id, diffs },
    },
    {
      kind: 'text',
      content: c
        ? ` Compare view is up on the canvas. A third candidate from ${c.employer_name ?? 'an unnamed employer'} is also in the result set. Ask for a pair against it for a deeper bake-off.`
        : ' Compare view is up on the canvas. The pair reads tighter than the rest of the top batch.',
    },
  ]

  return {
    prompt: 'Compare two top machine learning roles side by side',
    chipLabel: 'Compare two top machine learning roles side by side',
    messageId: 'mock-message-compare',
    profile: AI_ENGINEER_PROFILE,
    steps,
  }
}

async function buildDeadlineTimeline(): Promise<MockScript> {
  const slug = 'deadline-ai'
  const candidates = (await liveSearch('AI engineer', undefined, undefined, 15))
    .filter((ad) => ad.application_deadline)
    .map((ad) => ({
      ad,
      days: daysUntil(ad.application_deadline),
    }))
    .filter((entry) => entry.days <= 21)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5)
  const aliveAds = await dropDeadAds(
    slug,
    candidates.map((entry) => entry.ad),
  )
  const aliveAdIds = new Set(aliveAds.map((ad) => ad.ad_id))
  const liveCandidates = candidates.filter((entry) =>
    aliveAdIds.has(entry.ad.ad_id),
  )
  if (liveCandidates.length < 3)
    throw new Error('Expected at least 3 deadline ads for timeline chip')

  const deadlineAds: DeadlineAdSummary[] = liveCandidates.map(
    ({ ad, days }) => ({
      ad_id: ad.ad_id,
      headline: ad.headline,
      employer_name: ad.employer_name,
      municipality: ad.municipality,
      application_deadline: ad.application_deadline,
      webpage_url: ad.webpage_url,
      days_until_deadline: days,
    }),
  )
  const adIds = deadlineAds.map((ad) => ad.ad_id)
  const today = new Date().toISOString().slice(0, 10)
  const soonest = deadlineAds[0]

  const steps: MockStep[] = [
    {
      kind: 'text',
      content:
        'Pulling AI engineering ads whose application deadline lands inside the next two weeks.',
    },
    {
      kind: 'tool',
      toolName: 'deadlineWatch',
      toolCallId: callId(slug, 1),
      input: { window_days: 14, top_k: 5 },
      output: { results: deadlineAds },
    },
    {
      kind: 'tool',
      toolName: 'placeAdsOnTimeline',
      toolCallId: callId(slug, 2),
      input: { ad_ids: adIds, today_cursor: today },
      output: { accepted: true, ad_ids: adIds, today_cursor: today },
    },
    {
      kind: 'text',
      content: ` ${deadlineAds.length} roles laid on the date axis. The soonest is ${soonest.headline.trim()} at ${soonest.employer_name ?? 'an unnamed employer'}, ${soonest.days_until_deadline} day${soonest.days_until_deadline === 1 ? '' : 's'} out.`,
    },
  ]

  return {
    prompt: 'Which AI roles are closing in the next two weeks',
    chipLabel: 'Which AI roles are closing in the next two weeks',
    messageId: 'mock-message-deadline',
    profile: AI_ENGINEER_PROFILE,
    steps,
  }
}

function serializeScript(script: MockScript, exportName: string): string {
  const banner = [
    '// AUTO-GENERATED by web/scripts/capture-mock-fixtures.ts',
    '// Do not edit by hand. Re-run the script when the ads expire.',
    '',
  ].join('\n')
  const json = JSON.stringify(script, null, 2)
  return `${banner}\nimport type { MockScript } from '@/features/mock/scripts/types'\n\nexport const ${exportName}: MockScript = ${json} as const\n`
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  const outDir = join(here, '..', 'src', 'features', 'mock', 'scripts')
  mkdirSync(outDir, { recursive: true })

  const [ai, nursing, compare, deadline] = await Promise.all([
    buildStockholmAiEngineering(),
    buildStockholmNursing(),
    buildCompareThreeRoles(),
    buildDeadlineTimeline(),
  ])

  writeFileSync(
    join(outDir, 'stockholm-ai-engineering.ts'),
    serializeScript(ai, 'stockholmAiEngineeringScript'),
    'utf8',
  )
  writeFileSync(
    join(outDir, 'stockholm-nursing.ts'),
    serializeScript(nursing, 'stockholmNursingScript'),
    'utf8',
  )
  writeFileSync(
    join(outDir, 'compare-three-roles.ts'),
    serializeScript(compare, 'compareThreeRolesScript'),
    'utf8',
  )
  writeFileSync(
    join(outDir, 'deadline-timeline.ts'),
    serializeScript(deadline, 'deadlineTimelineScript'),
    'utf8',
  )

  console.log(`Wrote four mock fixtures to ${outDir}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
