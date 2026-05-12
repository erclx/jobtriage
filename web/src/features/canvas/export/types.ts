export interface ShortlistEntry {
  readonly adId: string
  readonly headline: string
  readonly employer: string | null
  readonly municipality: string | null
  readonly deadline: string | null
  readonly webpageUrl: string | null
  readonly rationale: string
}

export interface ExportContext {
  readonly demoUrl: string
}
