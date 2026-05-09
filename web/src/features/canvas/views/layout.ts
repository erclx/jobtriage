import {
  type AdGroup,
  type CanvasState,
  PROFILE_NODE_ID,
} from '@/features/canvas/canvas-state'
import type { GroupNodeData } from '@/features/canvas/nodes/group-node'

export const AD_NODE_WIDTH = 288
export const AD_NODE_HEIGHT = 240
export const NODE_GAP = 48
export const PROFILE_X = -440
export const PROFILE_Y = 0

export interface LayoutNode {
  readonly id: string
  readonly type: 'ad' | 'group' | 'profile'
  readonly position: { x: number; y: number }
  readonly data: Record<string, unknown>
  readonly draggable?: boolean
  readonly selectable?: boolean
  readonly zIndex?: number
}

export interface LayoutEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly type: string
  readonly data?: Record<string, unknown>
}

export interface ViewLayout {
  readonly nodes: readonly LayoutNode[]
  readonly edges: readonly LayoutEdge[]
}

export function gridLayout(
  adIds: readonly string[],
  originX = 0,
  originY = 0,
): {
  positions: Record<string, { x: number; y: number }>
  width: number
  height: number
} {
  const columns = Math.min(3, Math.max(1, adIds.length))
  const rows = Math.ceil(adIds.length / columns)
  const positions: Record<string, { x: number; y: number }> = {}
  adIds.forEach((id, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    positions[id] = {
      x: originX + col * (AD_NODE_WIDTH + NODE_GAP),
      y: originY + row * (AD_NODE_HEIGHT + NODE_GAP),
    }
  })
  return {
    positions,
    width: columns * (AD_NODE_WIDTH + NODE_GAP) - NODE_GAP,
    height: rows * (AD_NODE_HEIGHT + NODE_GAP) - NODE_GAP,
  }
}

export function stackLayout(
  adIds: readonly string[],
  originX = 0,
  originY = 0,
  spacingY = AD_NODE_HEIGHT + NODE_GAP,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  adIds.forEach((id, index) => {
    positions[id] = { x: originX, y: originY + index * spacingY }
  })
  return positions
}

export function classifyTone(label: string): GroupNodeData['tone'] {
  const lower = label.toLowerCase()
  if (
    lower.includes('strong') ||
    lower.includes('top') ||
    lower.includes('best')
  ) {
    return 'strong'
  }
  if (lower.includes('consider') || lower.includes('maybe')) {
    return 'consider'
  }
  if (
    lower.includes('pass') ||
    lower.includes('weak') ||
    lower.includes('skip')
  ) {
    return 'pass'
  }
  return 'neutral'
}

const GROUP_HEADER_HEIGHT = 36
const GROUP_PADDING = 16

export function groupLayout(groups: readonly AdGroup[]): ViewLayout {
  const nodes: LayoutNode[] = []
  let cursorX = 0
  groups.forEach((group, groupIndex) => {
    const adIds = group.adIds
    const columns = adIds.length === 0 ? 1 : Math.min(2, adIds.length)
    const rows = Math.ceil(Math.max(1, adIds.length) / columns)
    const innerWidth = columns * AD_NODE_WIDTH + (columns - 1) * NODE_GAP
    const innerHeight = rows * AD_NODE_HEIGHT + (rows - 1) * NODE_GAP
    const groupWidth = innerWidth + GROUP_PADDING * 2
    const groupHeight = innerHeight + GROUP_PADDING * 2 + GROUP_HEADER_HEIGHT
    const groupId = `group-${groupIndex}-${slug(group.label)}`

    nodes.push({
      id: groupId,
      type: 'group',
      position: { x: cursorX, y: 0 },
      data: {
        label: group.label,
        tone: classifyTone(group.label),
        width: groupWidth,
        height: groupHeight,
      },
      draggable: false,
      selectable: false,
      zIndex: 0,
    })

    adIds.forEach((adId, adIndex) => {
      const col = adIndex % columns
      const row = Math.floor(adIndex / columns)
      nodes.push({
        id: adId,
        type: 'ad',
        position: {
          x: cursorX + GROUP_PADDING + col * (AD_NODE_WIDTH + NODE_GAP),
          y:
            GROUP_PADDING +
            GROUP_HEADER_HEIGHT +
            row * (AD_NODE_HEIGHT + NODE_GAP),
        },
        data: { adId },
        zIndex: 1,
      })
    })

    cursorX += groupWidth + NODE_GAP * 2
  })

  return { nodes, edges: [] }
}

export function timelineLayout(state: CanvasState): ViewLayout {
  const timeline = state.timeline
  if (!timeline) return { nodes: [], edges: [] }

  const cursor = parseIsoDate(timeline.todayCursor)
  if (!cursor) return { nodes: [], edges: [] }

  const ads = timeline.adIds
    .map((adId) => state.adRegistry[adId])
    .filter((ad): ad is NonNullable<typeof ad> => Boolean(ad))

  const dayWidth = 80
  const lanes: number[] = []

  const nodes: LayoutNode[] = ads.map((ad) => {
    const days = resolveDeadlineDays(ad, cursor)
    const x = days * dayWidth
    let lane = 0
    while (lanes[lane] !== undefined && lanes[lane] >= x - AD_NODE_WIDTH) {
      lane += 1
    }
    lanes[lane] = x
    return {
      id: ad.ad_id,
      type: 'ad',
      position: { x, y: lane * (AD_NODE_HEIGHT + NODE_GAP) },
      data: { adId: ad.ad_id },
      zIndex: 1,
    }
  })

  return { nodes, edges: [] }
}

interface NormalizedAd {
  readonly ad_id: string
  readonly application_deadline?: string | null
  readonly days_until_deadline?: number
}

function resolveDeadlineDays(ad: NormalizedAd, cursor: Date): number {
  if (typeof ad.days_until_deadline === 'number') {
    return Math.max(0, ad.days_until_deadline)
  }
  if (!ad.application_deadline) return 0
  const target = parseIsoDate(ad.application_deadline.slice(0, 10))
  if (!target) return 0
  const diff = Math.round(
    (target.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24),
  )
  return Math.max(0, diff)
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function profileNodeLayout(): LayoutNode {
  return {
    id: PROFILE_NODE_ID,
    type: 'profile',
    position: { x: PROFILE_X, y: PROFILE_Y },
    data: {},
    zIndex: 2,
  }
}

export function compareLayout(state: CanvasState): ViewLayout {
  if (!state.comparePair) return { nodes: [], edges: [] }
  const { adIdA, adIdB } = state.comparePair
  return {
    nodes: [
      {
        id: adIdA,
        type: 'ad',
        position: { x: 0, y: 0 },
        data: { adId: adIdA },
        zIndex: 1,
      },
      {
        id: adIdB,
        type: 'ad',
        position: { x: AD_NODE_WIDTH + NODE_GAP * 4, y: 0 },
        data: { adId: adIdB },
        zIndex: 1,
      },
    ],
    edges: [],
  }
}

export function shortlistLayout(state: CanvasState): ViewLayout {
  const positions = stackLayout(state.pinnedAdIds, 0, 0)
  return {
    nodes: state.pinnedAdIds.map((adId) => ({
      id: adId,
      type: 'ad',
      position: positions[adId],
      data: { adId },
      zIndex: 1,
    })),
    edges: [],
  }
}
