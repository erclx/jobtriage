import { describe, expect, it } from 'vitest'

import { INTER_PROBE_DEFAULTS_MS, resolveInterProbeMs } from './pacing'

describe('resolveInterProbeMs', () => {
  it('should return the gemini default when no override is set', () => {
    const delay = resolveInterProbeMs('gemini', {})
    expect(delay).toBe(INTER_PROBE_DEFAULTS_MS.gemini)
  })

  it('should return 0 for anthropic, openai, and ollama by default', () => {
    expect(resolveInterProbeMs('anthropic', {})).toBe(0)
    expect(resolveInterProbeMs('openai', {})).toBe(0)
    expect(resolveInterProbeMs('ollama', {})).toBe(0)
  })

  it('should return 0 for an unknown provider with no override', () => {
    const delay = resolveInterProbeMs('unknown', {})
    expect(delay).toBe(0)
  })

  it('should lowercase the provider before lookup', () => {
    const delay = resolveInterProbeMs('Gemini', {})
    expect(delay).toBe(INTER_PROBE_DEFAULTS_MS.gemini)
  })

  it('should let PROBE_INTER_PROBE_MS override the per-provider default', () => {
    const delay = resolveInterProbeMs('gemini', { PROBE_INTER_PROBE_MS: '250' })
    expect(delay).toBe(250)
  })

  it('should let an override of 0 disable pacing on a paced provider', () => {
    const delay = resolveInterProbeMs('gemini', { PROBE_INTER_PROBE_MS: '0' })
    expect(delay).toBe(0)
  })

  it('should treat an empty override as no override', () => {
    const delay = resolveInterProbeMs('gemini', { PROBE_INTER_PROBE_MS: '' })
    expect(delay).toBe(INTER_PROBE_DEFAULTS_MS.gemini)
  })

  it('should throw when the override is not a non-negative number', () => {
    expect(() =>
      resolveInterProbeMs('gemini', { PROBE_INTER_PROBE_MS: 'abc' }),
    ).toThrow(/non-negative number/)
    expect(() =>
      resolveInterProbeMs('gemini', { PROBE_INTER_PROBE_MS: '-1' }),
    ).toThrow(/non-negative number/)
  })
})
