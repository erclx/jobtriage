import { describe, expect, it } from 'vitest'

import { toMarkdown } from './markdown'
import type { ShortlistEntry } from './types'

const DEMO_URL = 'https://jobtriage.erclx.dev'

function entry(overrides: Partial<ShortlistEntry> = {}): ShortlistEntry {
  return {
    adId: 'a1',
    headline: 'Senior AI engineer',
    employer: 'Acme AB',
    municipality: 'Stockholm',
    deadline: '2026-06-01',
    webpageUrl: 'https://example.com/a1',
    rationale: 'Stockholm plus Azure ML',
    ...overrides,
  }
}

describe('toMarkdown', () => {
  it('should emit header and footer for an empty shortlist', () => {
    const output = toMarkdown([], { demoUrl: DEMO_URL })

    expect(output).toContain('# Shortlist (0)')
    expect(output).toContain(`> Exported from ${DEMO_URL}`)
  })

  it('should render a single ad with all fields populated', () => {
    const output = toMarkdown([entry()], { demoUrl: DEMO_URL })

    expect(output).toContain('## Senior AI engineer')
    expect(output).toContain('Acme AB · Stockholm')
    expect(output).toContain('Apply by 2026-06-01')
    expect(output).toContain('[Open on Platsbanken](https://example.com/a1)')
    expect(output).toContain('Stockholm plus Azure ML')
  })

  it('should omit rationale block when rationale is empty', () => {
    const output = toMarkdown([entry({ rationale: '' })], {
      demoUrl: DEMO_URL,
    })

    expect(output).toContain('## Senior AI engineer')
    expect(output).not.toContain('Stockholm plus Azure ML')
  })

  it('should join multiple ads in pin order', () => {
    const output = toMarkdown(
      [
        entry({ adId: 'a1', headline: 'First role' }),
        entry({ adId: 'a2', headline: 'Second role' }),
      ],
      { demoUrl: DEMO_URL },
    )

    const firstIdx = output.indexOf('## First role')
    const secondIdx = output.indexOf('## Second role')
    expect(firstIdx).toBeGreaterThan(-1)
    expect(secondIdx).toBeGreaterThan(firstIdx)
  })

  it('should drop the location line when both employer and municipality are missing', () => {
    const output = toMarkdown([entry({ employer: null, municipality: null })], {
      demoUrl: DEMO_URL,
    })

    expect(output).not.toContain('·')
  })
})
