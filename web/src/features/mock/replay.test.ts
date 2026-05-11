/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { replayFallbackText, replayMockScript } from './replay'
import type { MockScript } from './scripts/types'

async function collect(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Missing body')
  const decoder = new TextDecoder()
  let acc = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    acc += decoder.decode(value)
  }
  return acc
}

function parseEvents(
  raw: string,
): { readonly type?: string; [k: string]: unknown }[] {
  return raw
    .split('\n\n')
    .map((line) => line.replace(/^data:\s*/, '').trim())
    .filter((line) => line.length > 0 && line !== '[DONE]')
    .map((line) => JSON.parse(line) as { type?: string })
}

describe('replayMockScript', () => {
  it('should emit start, text, tool, finish, and [DONE] in order', async () => {
    const script: MockScript = {
      prompt: 'demo prompt',
      chipLabel: 'demo prompt',
      messageId: 'msg-1',
      steps: [
        { kind: 'text', content: 'Hello there' },
        {
          kind: 'tool',
          toolName: 'searchJobs',
          toolCallId: 'call-1',
          input: { query: 'ai' },
          output: { results: [] },
        },
        { kind: 'text', content: 'Done' },
      ],
    }

    const response = replayMockScript(script)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1')
    expect(response.headers.get('content-type')).toBe('text/event-stream')

    const raw = await collect(response)
    expect(raw.endsWith('data: [DONE]\n\n')).toBe(true)

    const events = parseEvents(raw)
    const types = events.map((event) => event.type)
    expect(types[0]).toBe('start')
    expect(types).toContain('text-start')
    expect(types).toContain('text-delta')
    expect(types).toContain('text-end')
    expect(types).toContain('tool-input-available')
    expect(types).toContain('tool-output-available')
    expect(types).toContain('finish-step')
    expect(types.at(-1)).toBe('finish')

    const toolInput = events.find(
      (event) => event.type === 'tool-input-available',
    ) as { toolName?: string; toolCallId?: string } | undefined
    expect(toolInput?.toolName).toBe('searchJobs')
    expect(toolInput?.toolCallId).toBe('call-1')
  })

  it('should emit input-available before output-available for the same tool call', async () => {
    const script: MockScript = {
      prompt: 'demo',
      chipLabel: 'demo',
      messageId: 'msg-2',
      steps: [
        {
          kind: 'tool',
          toolName: 'placeAds',
          toolCallId: 'call-2',
          input: { ad_ids: ['a'] },
          output: { accepted: true },
        },
      ],
    }
    const raw = await collect(replayMockScript(script))
    const inputIndex = raw.indexOf('"tool-input-available"')
    const outputIndex = raw.indexOf('"tool-output-available"')
    expect(inputIndex).toBeGreaterThan(-1)
    expect(outputIndex).toBeGreaterThan(inputIndex)
  })
})

describe('replayFallbackText', () => {
  it('should stream a single text-only assistant message', async () => {
    const response = replayFallbackText(
      'Switch to BYOK to ask your own question.',
    )
    const events = parseEvents(await collect(response))
    const deltas = events
      .filter((event) => event.type === 'text-delta')
      .map((event) => (event as { delta: string }).delta)
      .join('')
    expect(deltas).toContain('Switch to BYOK')
    expect(events.some((event) => event.type === 'tool-input-available')).toBe(
      false,
    )
  })
})
