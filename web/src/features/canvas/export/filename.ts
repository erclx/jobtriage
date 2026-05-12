const FALLBACK_BASE = 'shortlist'
const MAX_BASE_LENGTH = 64

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function isoDate(today: Date): string {
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
}

export function slugify(input: string): string {
  const normalized = input.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return slug.slice(0, MAX_BASE_LENGTH) || FALLBACK_BASE
}

export function buildFilename(
  name: string,
  extension: 'md' | 'csv',
  today: Date,
): string {
  const base = slugify(name)
  return `${base}_${isoDate(today)}.${extension}`
}
