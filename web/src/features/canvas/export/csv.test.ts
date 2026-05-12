import { describe, expect, it } from 'vitest'

import { toCsv } from './csv'
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

describe('toCsv', () => {
  it('should emit the header row first', () => {
    const output = toCsv([], { demoUrl: DEMO_URL })

    expect(output.split('\r\n')[0]).toBe(
      'title,employer,municipality,deadline,link,rationale',
    )
  })

  it('should emit the demo-url footer as a trailing comment row', () => {
    const output = toCsv([entry()], { demoUrl: DEMO_URL })

    expect(output).toContain(`# Exported from ${DEMO_URL}`)
  })

  it('should wrap a comma-bearing rationale in double quotes', () => {
    const output = toCsv([entry({ rationale: 'Stockholm, Azure ML' })], {
      demoUrl: DEMO_URL,
    })

    expect(output).toContain('"Stockholm, Azure ML"')
  })

  it('should double internal double quotes per RFC 4180', () => {
    const output = toCsv([entry({ rationale: 'Strong "fit" overall' })], {
      demoUrl: DEMO_URL,
    })

    expect(output).toContain('"Strong ""fit"" overall"')
  })

  it('should wrap a newline-bearing rationale in double quotes', () => {
    const output = toCsv([entry({ rationale: 'Line one\nLine two' })], {
      demoUrl: DEMO_URL,
    })

    expect(output).toContain('"Line one\nLine two"')
  })

  it('should emit an empty field when rationale is empty', () => {
    const output = toCsv([entry({ rationale: '' })], { demoUrl: DEMO_URL })
    const dataRow = output.split('\r\n')[1]

    expect(dataRow?.endsWith(',')).toBe(true)
  })

  it('should emit one row per entry in pin order', () => {
    const output = toCsv(
      [
        entry({ adId: 'a1', headline: 'First role' }),
        entry({ adId: 'a2', headline: 'Second role' }),
      ],
      { demoUrl: DEMO_URL },
    )
    const rows = output.split('\r\n')

    expect(rows[1]?.startsWith('First role,')).toBe(true)
    expect(rows[2]?.startsWith('Second role,')).toBe(true)
  })
})
