import type { CanvasView } from '@/features/canvas/canvas-state'

export function shouldShowProfileNode(
  view: CanvasView,
  pinnedCount: number,
): boolean {
  return !(view === 'shortlist' && pinnedCount === 0)
}
