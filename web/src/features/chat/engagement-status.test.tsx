import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EngagementStatusCard } from './engagement-status'

describe('EngagementStatusCard', () => {
  it('renders entries when present', () => {
    render(
      <EngagementStatusCard
        status={{
          ad_id: 'ad-1',
          entries: [
            {
              recorded_on: '2026-05-01',
              status: 'shortlisted',
              note: 'strong match',
            },
          ],
        }}
      />,
    )

    expect(screen.getByText(/Engagement log for ad-1/)).toBeInTheDocument()
    expect(
      screen.getByText(/2026-05-01.*shortlisted.*strong match/),
    ).toBeInTheDocument()
  })

  it('renders the not-tracked empty state with the ad id', () => {
    render(<EngagementStatusCard status={{ ad_id: 'ad-2', entries: [] }} />)

    expect(screen.getByText(/Not tracked yet for ad-2/)).toBeInTheDocument()
    expect(screen.getByText(/CLI on the demo build/)).toBeInTheDocument()
  })
})
