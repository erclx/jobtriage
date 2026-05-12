import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdCardData } from '@/features/chat/ad-card-types'

import {
  CanvasContext,
  type CanvasState,
  INITIAL_CANVAS_STATE,
} from '../canvas-state'
import { ExportShortlistButton } from './export-shortlist-button'

const DEMO_URL = 'https://jobtriage.erclx.dev'

function ad(id: string, overrides: Partial<AdCardData> = {}): AdCardData {
  return {
    ad_id: id,
    headline: `Headline ${id}`,
    employer_name: 'Acme AB',
    municipality: 'Stockholm',
    application_deadline: '2026-06-01',
    webpage_url: `https://example.com/${id}`,
    description_excerpt: `Excerpt ${id}`,
    ...overrides,
  }
}

function renderWith(state: Partial<CanvasState> = {}) {
  const dispatch = vi.fn()
  return render(
    <CanvasContext.Provider
      value={{ state: { ...INITIAL_CANVAS_STATE, ...state }, dispatch }}
    >
      <ExportShortlistButton demoUrl={DEMO_URL} />
    </CanvasContext.Provider>,
  )
}

describe('ExportShortlistButton', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:fake')
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('should disable both triggers when no ad is pinned', () => {
    renderWith({})

    const primary = screen.getByRole('button', { name: /Export shortlist/i })
    const chevron = screen.getByRole('button', {
      name: /Export format options/i,
    })

    expect(primary).toBeDisabled()
    expect(chevron).toBeDisabled()
    expect(primary).toHaveAttribute('title', 'Pin an ad to enable export')
  })

  it('should derive the default filename from the first pinned ad employer and headline', () => {
    renderWith({
      pinnedAdIds: ['a1'],
      adRegistry: {
        a1: ad('a1', { employer_name: 'Acme AB', headline: 'Senior AI' }),
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Export shortlist' }))

    const input = screen.getByLabelText('File name') as HTMLInputElement
    expect(input.value).toBe('acme-ab-senior-ai')
  })

  it('should download markdown with the user-edited filename on Markdown click', () => {
    renderWith({
      pinnedAdIds: ['a1'],
      adRegistry: { a1: ad('a1') },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Export shortlist' }))
    const input = screen.getByLabelText('File name') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'my list' } })
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/markdown;charset=utf-8')
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('should download CSV from the popover when CSV is clicked', () => {
    renderWith({
      pinnedAdIds: ['a1'],
      adRegistry: { a1: ad('a1') },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Export shortlist' }))
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8')
  })

  it('should download CSV via the chevron menu using the default filename without opening the popover', async () => {
    const user = userEvent.setup()
    renderWith({
      pinnedAdIds: ['a1'],
      adRegistry: { a1: ad('a1') },
    })

    await user.click(
      screen.getByRole('button', { name: 'Export format options' }),
    )
    const menu = await screen.findByRole('menu')
    await user.click(within(menu).getByText('CSV (.csv)'))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })
})
