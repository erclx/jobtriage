import { render, screen } from '@testing-library/react'
import type { ToolUIPart } from 'ai'
import { describe, expect, it } from 'vitest'

import { ToolTrace } from './tool-trace'

const buildPart = <S extends ToolUIPart['state']>(
  overrides: { state: S } & Partial<ToolUIPart>,
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

  it('should render the parameters block once input is available', () => {
    render(
      <ToolTrace
        part={buildPart({
          state: 'input-available',
          input: { query: 'AI engineer', top_k: 5 },
        })}
      />,
    )
    expect(screen.getByText(/parameters/i)).toBeInTheDocument()
  })

  it('should render the result block once output is available', () => {
    render(
      <ToolTrace
        part={buildPart({
          state: 'output-available',
          input: { query: 'AI engineer', top_k: 5 },
          output: { results: [] },
        })}
      />,
    )
    expect(screen.getByRole('heading', { name: /result/i })).toBeInTheDocument()
  })
})
