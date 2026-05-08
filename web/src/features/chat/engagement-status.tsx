'use client'

import type { EngagementStatusResponse } from '@/lib/api/schemas'

interface EngagementStatusProps {
  status: EngagementStatusResponse
}

export function EngagementStatusCard({ status }: EngagementStatusProps) {
  if (status.entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
        Not tracked yet for {status.ad_id}. Engagement state is written from the
        CLI on the demo build.
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs">
      <p className="font-medium">Engagement log for {status.ad_id}</p>
      <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
        {status.entries.map((entry, index) => (
          <li key={`${entry.recorded_on}-${index}`}>
            {entry.recorded_on} · {entry.status}
            {entry.note ? ` · ${entry.note}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
