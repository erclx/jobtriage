import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AdCard } from './ad-card'
import type { AdCardData } from './ad-card-types'

function makeAd(overrides: Partial<AdCardData> = {}): AdCardData {
  return {
    ad_id: 'ad-1',
    headline: 'Senior AI engineer',
    employer_name: 'Acme AB',
    municipality: 'Stockholm',
    application_deadline: '2026-06-01',
    webpage_url: 'https://example.com/ad-1',
    ...overrides,
  }
}

describe('AdCard', () => {
  it('renders headline, employer, and a Platsbanken link with safe rel', () => {
    render(<AdCard ad={makeAd()} />)

    expect(
      screen.getByRole('heading', { name: /Senior AI engineer/ }),
    ).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Open on Platsbanken/ })
    expect(link).toHaveAttribute('href', 'https://example.com/ad-1')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('omits the link when no webpage_url is present', () => {
    render(<AdCard ad={makeAd({ webpage_url: null })} />)

    expect(
      screen.queryByRole('link', { name: /Open on Platsbanken/ }),
    ).not.toBeInTheDocument()
  })

  it('shows the description excerpt when provided', () => {
    render(
      <AdCard
        ad={makeAd({ description_excerpt: 'Build agents in Stockholm.' })}
      />,
    )

    expect(screen.getByText(/Build agents in Stockholm/)).toBeInTheDocument()
  })

  it('shows the deadline countdown badge in deadline variant', () => {
    render(
      <AdCard ad={makeAd({ days_until_deadline: 3 })} variant="deadline" />,
    )

    expect(screen.getByText('3 days left')).toBeInTheDocument()
  })

  it('renders Today when deadline countdown is zero', () => {
    render(
      <AdCard ad={makeAd({ days_until_deadline: 0 })} variant="deadline" />,
    )

    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('clamps the matched-variant excerpt and toggles via Read more', async () => {
    const user = userEvent.setup()
    const longExcerpt =
      'Build agents in Stockholm with Azure ML and Mastra. ' +
      'You will own retrieval, evals, and the agent loop. '.repeat(8)
    render(
      <AdCard
        ad={makeAd({ description_excerpt: longExcerpt })}
        variant="matched"
      />,
    )

    const excerpt = screen.getByText(/Build agents in Stockholm/)
    expect(excerpt.className).toContain('line-clamp-4')
    const toggle = screen.getByRole('button', { name: /Read more/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(excerpt.className).not.toContain('line-clamp-4')
    expect(screen.getByRole('button', { name: /Read less/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('does not render a read-more toggle on non-matched variants', () => {
    render(
      <AdCard
        ad={makeAd({ description_excerpt: 'Build agents in Stockholm.' })}
      />,
    )

    expect(
      screen.queryByRole('button', { name: /Read more/i }),
    ).not.toBeInTheDocument()
  })
})
