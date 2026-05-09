import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  CanvasContext,
  type CanvasState,
  INITIAL_CANVAS_STATE,
} from '@/features/canvas/canvas-state'

import { AdNode } from './ad-node'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}))

function renderAdNode(state: CanvasState) {
  const dispatch = vi.fn()
  render(
    <CanvasContext.Provider value={{ state, dispatch }}>
      <AdNode
        id="ad-1"
        data={{ adId: 'ad-1' } as unknown as Record<string, unknown>}
        type="ad"
        selected={false}
        zIndex={1}
        isConnectable
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        dragHandle=""
        dragging={false}
        deletable={false}
        selectable
        draggable
      />
    </CanvasContext.Provider>,
  )
  return dispatch
}

const baseAd = {
  ad_id: 'ad-1',
  headline: 'AI engineer',
  employer_name: 'Acme AB',
  municipality: 'Stockholm',
  application_deadline: '2026-06-01',
  webpage_url: 'https://example.com/ad-1',
  description_excerpt: 'Build agents in Stockholm with Azure ML',
}

describe('AdNode', () => {
  it('should render the ad headline and employer line from the registry', () => {
    renderAdNode({
      ...INITIAL_CANVAS_STATE,
      adRegistry: { 'ad-1': baseAd },
      visibleAdIds: ['ad-1'],
    })

    expect(
      screen.getByRole('heading', { name: /AI engineer/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Acme AB/)).toBeInTheDocument()
  })

  it('should dispatch pinToShortlist when the pin button is clicked', async () => {
    const dispatch = renderAdNode({
      ...INITIAL_CANVAS_STATE,
      adRegistry: { 'ad-1': baseAd },
      visibleAdIds: ['ad-1'],
    })

    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: /Pin ad to shortlist/i }),
    )

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pinToShortlist', adId: 'ad-1' }),
    )
  })

  it('should display the match rationale when the profile is connected to the ad', () => {
    renderAdNode({
      ...INITIAL_CANVAS_STATE,
      adRegistry: { 'ad-1': baseAd },
      visibleAdIds: ['ad-1'],
      profileMatches: [
        { adId: 'ad-1', score: 0.78, rationale: 'Stockholm + Azure ML' },
      ],
    })

    expect(screen.getByText(/78%/)).toBeInTheDocument()
    expect(screen.getByText(/Stockholm \+ Azure ML/)).toBeInTheDocument()
  })

  it('should toggle to unpinned label when already pinned', async () => {
    const dispatch = renderAdNode({
      ...INITIAL_CANVAS_STATE,
      adRegistry: { 'ad-1': baseAd },
      visibleAdIds: ['ad-1'],
      pinnedAdIds: ['ad-1'],
    })

    const user = userEvent.setup()
    expect(
      screen.getByRole('button', { name: /Unpin ad/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Unpin ad/i }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'unpinFromShortlist',
      adId: 'ad-1',
    })
  })
})
