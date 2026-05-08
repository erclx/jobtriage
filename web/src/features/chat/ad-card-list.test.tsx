import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AdCardList } from './ad-card-list'
import type { AdCardData } from './ad-card-types'

const sampleAd: AdCardData = {
  ad_id: 'ad-1',
  headline: 'Senior AI engineer',
  employer_name: 'Acme AB',
  municipality: 'Stockholm',
  application_deadline: '2026-06-01',
  webpage_url: 'https://example.com/ad-1',
}

describe('AdCardList', () => {
  it('renders ad cards when state is ready', () => {
    render(<AdCardList ads={[sampleAd]} state="ready" emptyCopy="No matches" />)

    expect(
      screen.getByRole('heading', { name: /Senior AI engineer/ }),
    ).toBeInTheDocument()
  })

  it('renders the loading status when state is loading', () => {
    render(<AdCardList ads={[]} state="loading" emptyCopy="No matches" />)

    expect(screen.getByTestId('ad-card-loading')).toHaveTextContent(
      /Loading ads/,
    )
  })

  it('renders the empty copy when state is empty', () => {
    render(
      <AdCardList
        ads={[]}
        state="empty"
        emptyCopy="No ads matched that filter."
      />,
    )

    expect(screen.getByText(/No ads matched that filter/)).toBeInTheDocument()
  })

  it('renders the empty copy when state is ready but ads is empty', () => {
    render(
      <AdCardList
        ads={[]}
        state="ready"
        emptyCopy="No ads matched that query."
      />,
    )

    expect(screen.getByText(/No ads matched that query/)).toBeInTheDocument()
  })

  it('renders the error message when state is error', () => {
    render(
      <AdCardList
        ads={[]}
        state="error"
        emptyCopy="No matches"
        errorMessage="Backend 502: bad gateway"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/Backend 502/)
  })
})
