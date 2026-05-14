import { describe, expect, it } from 'vitest'

import {
  type CanvasState,
  INITIAL_CANVAS_STATE,
} from '@/features/canvas/canvas-state'
import {
  AD_NODE_WIDTH,
  COMPARE_DIFF_OFFSET_Y,
  COMPARE_GAP_X,
  COMPARE_PAIR_WIDTH,
  compareLayout,
  TIMELINE_DAY_WIDTH,
  TIMELINE_TICK_DAYS,
  timelineAxisTicks,
  timelineLayout,
} from '@/features/canvas/views/layout'

const adFixture = (id: string, overrides: Record<string, unknown> = {}) => ({
  ad_id: id,
  headline: `Headline ${id}`,
  employer_name: `${id} employer`,
  municipality: 'Stockholm',
  application_deadline: '2026-06-01',
  webpage_url: `https://example.com/${id}`,
  ...overrides,
})

describe('compareLayout', () => {
  it('should emit an empty layout when no comparePair is set', () => {
    const layout = compareLayout(INITIAL_CANVAS_STATE)

    expect(layout.nodes).toHaveLength(0)
  })

  it('should emit a compareDiff overlay node carrying the diffs payload', () => {
    const state: CanvasState = {
      ...INITIAL_CANVAS_STATE,
      adRegistry: {
        a: adFixture('a', { employer_name: 'Acme' }),
        b: adFixture('b', { employer_name: 'Beta' }),
      },
      comparePair: {
        adIdA: 'a',
        adIdB: 'b',
        diffs: [
          { field: 'Stack', a: 'Azure ML', b: 'Sagemaker', verdict: 'a' },
          { field: 'Seniority', a: 'Senior', b: 'Senior', verdict: 'same' },
        ],
      },
    }

    const layout = compareLayout(state)
    const diffNode = layout.nodes.find((node) => node.type === 'compareDiff')

    expect(diffNode).toBeDefined()
    expect(diffNode?.position).toEqual({ x: 0, y: COMPARE_DIFF_OFFSET_Y })
    expect(diffNode?.data.width).toBe(COMPARE_PAIR_WIDTH)
    expect(diffNode?.data.labelA).toBe('Acme')
    expect(diffNode?.data.labelB).toBe('Beta')
    expect((diffNode?.data.diffs as readonly unknown[]).length).toBe(2)
    expect(diffNode?.draggable).toBe(false)
  })

  it('should place ad B at AD_NODE_WIDTH plus COMPARE_GAP_X from ad A', () => {
    const state: CanvasState = {
      ...INITIAL_CANVAS_STATE,
      comparePair: { adIdA: 'a', adIdB: 'b', diffs: [] },
    }

    const layout = compareLayout(state)
    const adB = layout.nodes.find((node) => node.id === 'b')

    expect(adB?.position.x).toBe(AD_NODE_WIDTH + COMPARE_GAP_X)
  })
})

describe('timelineLayout', () => {
  it('should place ads at days_until_deadline times the day width', () => {
    const state: CanvasState = {
      ...INITIAL_CANVAS_STATE,
      adRegistry: {
        a: adFixture('a', { days_until_deadline: 0 }),
        b: adFixture('b', { days_until_deadline: 7 }),
      },
      timeline: {
        todayCursor: '2026-05-14',
        adIds: ['a', 'b'],
      },
    }

    const layout = timelineLayout(state)
    const adA = layout.nodes.find((node) => node.id === 'a')
    const adB = layout.nodes.find((node) => node.id === 'b')

    expect(adA?.position.x).toBe(0)
    expect(adB?.position.x).toBe(7 * TIMELINE_DAY_WIDTH)
  })

  it('should return an empty layout when timeline state is null', () => {
    expect(timelineLayout(INITIAL_CANVAS_STATE).nodes).toHaveLength(0)
  })
})

describe('timelineAxisTicks', () => {
  it('should mirror TIMELINE_TICK_DAYS as screen-coordinate ticks', () => {
    const ticks = timelineAxisTicks()

    expect(ticks).toHaveLength(TIMELINE_TICK_DAYS.length)
    expect(ticks[0]).toEqual({ label: 'Today', x: 0, variant: 'today' })
    expect(ticks[1]).toEqual({
      label: '+5d',
      x: 5 * TIMELINE_DAY_WIDTH,
      variant: 'standard',
    })
    expect(ticks[2]).toEqual({
      label: '+14d',
      x: 14 * TIMELINE_DAY_WIDTH,
      variant: 'standard',
    })
  })
})
