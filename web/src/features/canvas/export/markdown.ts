import type { ExportContext, ShortlistEntry } from './types'

function locationLine(entry: ShortlistEntry): string {
  const parts = [entry.employer, entry.municipality].filter(
    (part): part is string => Boolean(part && part.trim()),
  )
  return parts.join(' · ')
}

function entryBlock(entry: ShortlistEntry): string {
  const lines: string[] = [`## ${entry.headline}`]
  const location = locationLine(entry)
  if (location) lines.push(location)
  if (entry.deadline) lines.push(`Apply by ${entry.deadline}`)
  if (entry.webpageUrl) lines.push(`[Open on Platsbanken](${entry.webpageUrl})`)
  if (entry.rationale) {
    lines.push('')
    lines.push(entry.rationale)
  }
  return lines.join('\n')
}

export function toMarkdown(
  entries: readonly ShortlistEntry[],
  context: ExportContext,
): string {
  const header = `# Shortlist (${entries.length})`
  const body = entries.map(entryBlock).join('\n\n')
  const footer = `> Exported from ${context.demoUrl}`
  return entries.length === 0
    ? `${header}\n\n${footer}\n`
    : `${header}\n\n${body}\n\n${footer}\n`
}
