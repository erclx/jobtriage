'use client'

import { useCallback, useEffect, useRef } from 'react'

interface RailSplitterProps {
  readonly minWidth: number
  readonly maxWidth: number
  readonly onResize: (width: number) => void
  readonly currentWidth: number
}

export function RailSplitter({
  minWidth,
  maxWidth,
  onResize,
  currentWidth,
}: RailSplitterProps) {
  const draggingRef = useRef(false)
  const onResizeRef = useRef(onResize)

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      const next = clamp(event.clientX, minWidth, maxWidth)
      onResizeRef.current(next)
    },
    [minWidth, maxWidth],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      event.currentTarget.releasePointerCapture(event.pointerId)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    },
    [],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 32 : 8
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onResizeRef.current(clamp(currentWidth - step, minWidth, maxWidth))
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onResizeRef.current(clamp(currentWidth + step, minWidth, maxWidth))
      }
    },
    [currentWidth, minWidth, maxWidth],
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={currentWidth}
      aria-label="Resize chat rail"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      className="group relative hidden w-2 shrink-0 cursor-col-resize items-center justify-center bg-transparent outline-none lg:flex"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary/40 group-focus-visible:bg-primary/60"
      />
      <span
        aria-hidden
        className="relative h-10 w-1 rounded-full bg-border/80 transition-all group-hover:h-12 group-hover:w-1.5 group-hover:bg-primary group-focus-visible:h-12 group-focus-visible:w-1.5 group-focus-visible:bg-primary"
      />
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
