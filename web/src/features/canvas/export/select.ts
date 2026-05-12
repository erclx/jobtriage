import type { CanvasState } from '@/features/canvas/canvas-state'

import type { ShortlistEntry } from './types'

export function selectShortlistEntries(
  state: CanvasState,
): readonly ShortlistEntry[] {
  const matchById = new Map(
    state.profileMatches.map((link) => [link.adId, link.rationale]),
  )
  const entries: ShortlistEntry[] = []
  for (const adId of state.pinnedAdIds) {
    const ad = state.adRegistry[adId]
    if (!ad) continue
    const rationale =
      matchById.get(adId)?.trim() || ad.description_excerpt?.trim() || ''
    entries.push({
      adId,
      headline: ad.headline,
      employer: ad.employer_name ?? null,
      municipality: ad.municipality ?? null,
      deadline: ad.application_deadline ?? null,
      webpageUrl: ad.webpage_url ?? null,
      rationale,
    })
  }
  return entries
}
