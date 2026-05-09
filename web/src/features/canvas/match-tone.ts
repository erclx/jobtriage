export type MatchTone = 'strong' | 'consider' | 'pass'

export function matchToneFor(score: number): MatchTone {
  if (score >= 0.7) return 'strong'
  if (score >= 0.4) return 'consider'
  return 'pass'
}

export const MATCH_TONE_TEXT: Record<MatchTone, string> = {
  strong: 'text-emerald-600 dark:text-emerald-400',
  consider: 'text-amber-600 dark:text-amber-400',
  pass: 'text-muted-foreground',
}

export const MATCH_TONE_BORDER: Record<MatchTone, string> = {
  strong: 'border-emerald-500/40',
  consider: 'border-amber-500/40',
  pass: 'border-muted-foreground/30',
}
