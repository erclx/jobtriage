export const INTER_PROBE_DEFAULTS_MS = {
  gemini: 6500,
  openai: 0,
  anthropic: 0,
  ollama: 0,
} as const

export type ProbeProviderKey = keyof typeof INTER_PROBE_DEFAULTS_MS

export function resolveInterProbeMs(
  provider: string,
  env: Readonly<Record<string, string | undefined>>,
): number {
  const override = env.PROBE_INTER_PROBE_MS
  if (override !== undefined && override !== '') {
    const parsed = Number(override)
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(
        `PROBE_INTER_PROBE_MS must be a non-negative number, got "${override}"`,
      )
    }
    return parsed
  }
  const key = provider.toLowerCase() as ProbeProviderKey
  return INTER_PROBE_DEFAULTS_MS[key] ?? 0
}
