import { render } from '@testing-library/react'
import type { UIMessage } from 'ai'
import { describe, expect, it, vi } from 'vitest'

import { CanvasBridge } from './canvas-bridge'
import { CanvasContext, INITIAL_CANVAS_STATE } from './canvas-state'

function renderBridge(messages: readonly UIMessage[]) {
  const dispatch = vi.fn()
  render(
    <CanvasContext.Provider value={{ state: INITIAL_CANVAS_STATE, dispatch }}>
      <CanvasBridge messages={messages} />
    </CanvasContext.Provider>,
  )
  return dispatch
}

describe('CanvasBridge', () => {
  it('should dispatch placeAds when a triageBatch result is followed by a placeAds tool call', () => {
    const dispatch = renderBridge([
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-triageBatch',
            state: 'output-available',
            toolCallId: 'call-data',
            input: { query: 'AI engineer' },
            output: {
              results: [
                {
                  ad_id: 'ad-1',
                  headline: 'AI engineer',
                  employer_name: 'Acme AB',
                },
                {
                  ad_id: 'ad-2',
                  headline: 'Data scientist',
                  employer_name: 'Beta AB',
                },
              ],
            },
          },
          {
            type: 'tool-placeAds',
            state: 'output-available',
            toolCallId: 'call-spatial',
            input: { ad_ids: ['ad-1', 'ad-2'], layout: 'grid' },
            output: { accepted: true },
          },
        ],
      } as unknown as UIMessage,
    ])

    const placeCall = dispatch.mock.calls.find(
      ([action]) => action.type === 'placeAds',
    )
    expect(placeCall).toBeDefined()
    expect(placeCall?.[0].ads.map((ad: { ad_id: string }) => ad.ad_id)).toEqual(
      ['ad-1', 'ad-2'],
    )
    expect(placeCall?.[0].toolCallId).toBe('call-spatial')
  })

  it('should ignore spatial calls whose ad_ids never appeared in a data tool', () => {
    const dispatch = renderBridge([
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-placeAds',
            state: 'output-available',
            toolCallId: 'call-spatial',
            input: { ad_ids: ['ghost'], layout: 'grid' },
            output: { accepted: true },
          },
        ],
      } as unknown as UIMessage,
    ])

    const placeCall = dispatch.mock.calls.find(
      ([action]) => action.type === 'placeAds',
    )
    expect(placeCall?.[0].ads).toEqual([])
  })

  it('should dispatch pinToShortlist on pin tool output', () => {
    const dispatch = renderBridge([
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-pinToShortlist',
            state: 'output-available',
            toolCallId: 'pin-1',
            input: { ad_id: 'ad-9' },
            output: { accepted: true },
          },
        ],
      } as unknown as UIMessage,
    ])

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pinToShortlist',
        adId: 'ad-9',
        toolCallId: 'pin-1',
      }),
    )
  })

  it('should dispatch setView when the agent calls setView alone', () => {
    const dispatch = renderBridge([
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-setView',
            state: 'output-available',
            toolCallId: 'view-1',
            input: { view: 'shortlist' },
            output: { accepted: true },
          },
        ],
      } as unknown as UIMessage,
    ])

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setView', view: 'shortlist' }),
    )
  })

  it('should ignore tool parts that have not produced output yet', () => {
    const dispatch = renderBridge([
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-placeAds',
            state: 'input-streaming',
            toolCallId: 'call-spatial',
            input: { ad_ids: ['ad-1'], layout: 'grid' },
          },
        ],
      } as unknown as UIMessage,
    ])

    expect(dispatch).not.toHaveBeenCalled()
  })
})
