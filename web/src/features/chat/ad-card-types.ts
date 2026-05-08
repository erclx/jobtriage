import type {
  AdDetail,
  AdSummary,
  DeadlineAd,
  RankedAd,
  TriagedAd,
} from '@/lib/api/schemas'

export type AdCardData = AdSummary &
  Partial<Pick<RankedAd, 'score'>> &
  Partial<Pick<AdDetail, 'description_excerpt' | 'occupation_label'>> &
  Partial<Pick<DeadlineAd, 'days_until_deadline'>>

export type AdCardVariant = 'default' | 'deadline' | 'matched'

export function toAdCardData(
  ad: AdSummary | RankedAd | AdDetail | TriagedAd | DeadlineAd,
): AdCardData {
  return ad as AdCardData
}
