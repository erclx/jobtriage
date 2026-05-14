import { describe, expect, it } from 'vitest'

import { shouldShowProfileNode } from './profile-node-visibility'

describe('shouldShowProfileNode', () => {
  it('should hide the profile node on shortlist with zero pinned ads', () => {
    expect(shouldShowProfileNode('shortlist', 0)).toBe(false)
  })

  it('should show the profile node on shortlist when at least one ad is pinned', () => {
    expect(shouldShowProfileNode('shortlist', 1)).toBe(true)
  })

  it('should show the profile node on triage regardless of pinned count', () => {
    expect(shouldShowProfileNode('triage', 0)).toBe(true)
    expect(shouldShowProfileNode('triage', 3)).toBe(true)
  })

  it('should show the profile node on compare and timeline regardless of pinned count', () => {
    expect(shouldShowProfileNode('compare', 0)).toBe(true)
    expect(shouldShowProfileNode('timeline', 0)).toBe(true)
  })
})
