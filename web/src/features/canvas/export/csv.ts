import type { ExportContext, ShortlistEntry } from './types'

const HEADERS = [
  'title',
  'employer',
  'municipality',
  'deadline',
  'link',
  'rationale',
] as const

function escapeField(value: string | null): string {
  if (value === null || value === '') return ''
  const needsQuoting = /[",\r\n]/.test(value)
  if (!needsQuoting) return value
  return `"${value.replace(/"/g, '""')}"`
}

function entryRow(entry: ShortlistEntry): string {
  return [
    escapeField(entry.headline),
    escapeField(entry.employer),
    escapeField(entry.municipality),
    escapeField(entry.deadline),
    escapeField(entry.webpageUrl),
    escapeField(entry.rationale),
  ].join(',')
}

export function toCsv(
  entries: readonly ShortlistEntry[],
  context: ExportContext,
): string {
  const lines: string[] = [HEADERS.join(',')]
  for (const entry of entries) lines.push(entryRow(entry))
  lines.push(`# Exported from ${context.demoUrl}`)
  return lines.join('\r\n') + '\r\n'
}
