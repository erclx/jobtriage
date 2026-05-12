import { describe, expect, it } from 'vitest'

import { buildFilename, slugify } from './filename'

const TODAY = new Date('2026-05-12T12:00:00Z')

describe('slugify', () => {
  it('should pass through ascii word characters lowercased', () => {
    expect(slugify('Acme Senior AI')).toBe('acme-senior-ai')
  })

  it('should fold accents into ascii equivalents', () => {
    expect(slugify('Göteborg AB')).toBe('goteborg-ab')
  })

  it('should strip emoji and other symbols', () => {
    expect(slugify('Acme 🚀 Stockholm')).toBe('acme-stockholm')
  })

  it('should collapse runs of separators into a single hyphen', () => {
    expect(slugify('a   b  c')).toBe('a-b-c')
  })

  it('should trim leading and trailing hyphens', () => {
    expect(slugify('--hello world--')).toBe('hello-world')
  })

  it('should truncate to 64 characters', () => {
    const long = 'a'.repeat(80)

    expect(slugify(long)).toHaveLength(64)
  })

  it('should fall back to shortlist when input has no usable characters', () => {
    expect(slugify('   ')).toBe('shortlist')
  })
})

describe('buildFilename', () => {
  it('should append the ISO date and extension', () => {
    expect(buildFilename('Acme Senior AI', 'md', TODAY)).toBe(
      'acme-senior-ai_2026-05-12.md',
    )
  })

  it('should respect the csv extension', () => {
    expect(buildFilename('Acme Senior AI', 'csv', TODAY)).toBe(
      'acme-senior-ai_2026-05-12.csv',
    )
  })
})
