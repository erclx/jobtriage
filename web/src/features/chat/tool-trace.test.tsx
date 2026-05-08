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
  it('omits the parameters block while input is still streaming', () => {
    render(<ToolTrace part={buildPart({ state: 'input-streaming' })} />)
    expect(screen.queryByText(/parameters/i)).not.toBeInTheDocument()
  })

  it('keeps the trace tree collapsed by default', () => {
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

  it('renders an empty card list when output has zero results', () => {
    render(
      <ToolTrace
        part={buildPart({
          state: 'output-available',
          input: { query: 'AI engineer', top_k: 5 },
          output: { results: [] },
        })}
      />,
    )
    expect(screen.getByText(/No ads matched that query/)).toBeInTheDocument()
  })

  it('renders ad cards for searchJobs output above the trace', () => {
    render(
      <ToolTrace
        part={buildPart({
          type: 'tool-searchJobs',
          state: 'output-available',
          input: { region: 'STH', top_k: 1 },
          output: {
            results: [
              {
                ad_id: 'ad-1',
                headline: 'Backend developer',
                employer_name: 'Acme AB',
                municipality: 'Stockholm',
                application_deadline: '2026-06-01',
                webpage_url: 'https://example.com/ad-1',
              },
            ],
          },
        })}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /Backend developer/ }),
    ).toBeInTheDocument()
  })

  it('renders an error block when state is output-error', () => {
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
