import { render, screen } from '@testing-library/react'
import type { ToolUIPart } from 'ai'
import { describe, expect, it } from 'vitest'

import { ToolTrace } from './tool-trace'

const buildPart = <S extends ToolUIPart['state']>(
  overrides: { state: S; type?: ToolUIPart['type'] } & Partial<ToolUIPart>,
): ToolUIPart =>
  ({
    type: 'tool-semanticSearch',
    toolCallId: 'call_test',
    ...overrides,
  }) as ToolUIPart

describe('ToolTrace', () => {
  it('should omit the parameters block while input is still streaming', () => {
    render(<ToolTrace part={buildPart({ state: 'input-streaming' })} />)
    expect(screen.queryByText(/parameters/i)).not.toBeInTheDocument()
  })

  it('should keep the trace tree collapsed by default', () => {
    render(
      <ToolTrace
        part={buildPart({
          state: 'input-available',
          input: { query: 'AI engineer', top_k: 5 },
        })}
      />,
    )
    expect(screen.queryByText(/parameters/i)).not.toBeInTheDocument()
  })

  it('should render an engagement card when trackStatus returns entries', () => {
    render(
      <ToolTrace
        part={buildPart({
          type: 'tool-trackStatus',
          state: 'output-available',
          input: { ad_id: 'ad-1' },
          output: {
            ad_id: 'ad-1',
            entries: [
              {
                recorded_on: '2026-05-01',
                status: 'shortlisted',
                note: '',
              },
            ],
          },
        })}
      />,
    )

    expect(screen.getByText(/Engagement log for ad-1/)).toBeInTheDocument()
  })

  it('should render an error block when state is output-error', () => {
    render(
      <ToolTrace
        part={buildPart({
          state: 'output-error',
          input: { query: 'x' },
          errorText: 'Backend 502: bad gateway',
        })}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/Backend 502/)
  })
})
