'use client'

import { useViewport } from '@xyflow/react'
import { CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface TimelineAxisOverlayTick {
  readonly label: string
  readonly x: number
  readonly variant: 'today' | 'standard'
}

interface TimelineAxisOverlayProps {
  readonly ticks: readonly TimelineAxisOverlayTick[]
}

export function TimelineAxisOverlay({ ticks }: TimelineAxisOverlayProps) {
  const { x: translateX, zoom } = useViewport()
  return (
    <div
      data-testid="timeline-axis-overlay"
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-10 overflow-hidden border-b border-border/60 bg-gradient-to-b from-card/95 to-card/70 backdrop-blur-md"
    >
      <div className="relative h-full">
        <div className="absolute inset-x-0 top-[22px] h-px bg-border" />
        {ticks.map((tick) => {
          const screenX = tick.x * zoom + translateX
          const isToday = tick.variant === 'today'
          return (
            <div
              key={`${tick.variant}-${tick.label}`}
              data-testid={`timeline-axis-tick-${isToday ? 'today' : tick.label.replace(/\s+/g, '-')}`}
              className="absolute top-1 flex -translate-x-1/2 flex-col items-center"
              style={{ left: screenX }}
            >
              <span
                className={cn(
                  'inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-none',
                  isToday
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-muted-foreground',
                )}
              >
                {isToday ? (
                  <CalendarIcon className="size-3" aria-hidden />
                ) : null}
                {tick.label}
              </span>
              <div
                className={cn(
                  'mt-1.5 w-px',
                  isToday
                    ? 'h-2.5 bg-amber-500/80 dark:bg-amber-400/80'
                    : 'h-1.5 bg-border',
                )}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
