/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  serverEnv: {
    JOBTRIAGE_API_BASE_URL: 'http://api.test',
    JOBTRIAGE_API_TIMEOUT_MS: 5_000,
  },
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    streamText: vi.fn(),
    convertToModelMessages: vi.fn(async () => []),
  }
})

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => () => 'anthropic-model-handle'),
}))
vi.mock('ollama-ai-provider-v2', () => ({
  createOllama: vi.fn(() => () => 'ollama-model-handle'),
}))

import { createAnthropic } from '@ai-sdk/anthropic'
import { convertToModelMessages, streamText } from 'ai'
import { createOllama } from 'ollama-ai-provider-v2'

import { POST } from './route'

const streamTextMock = vi.mocked(streamText)
const createAnthropicMock = vi.mocked(createAnthropic)
const createOllamaMock = vi.mocked(createOllama)
const convertToModelMessagesMock = vi.mocked(convertToModelMessages)

const buildRequest = (init: {
  body?: unknown
  authorization?: string | null
  provider?: string
}): Request => {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (init.authorization !== null) {
    headers.set('authorization', init.authorization ?? 'Bearer sk-ant-test')
  }
  if (init.provider) {
    headers.set('x-jobtriage-provider', init.provider)
  }
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(init.body ?? { messages: [] }),
  })
}

const mockStreamResult = (): void => {
  streamTextMock.mockReturnValue({
    toUIMessageStreamResponse: () =>
      new Response('ok', { status: 200, headers: { 'x-stream': '1' } }),
  } as unknown as ReturnType<typeof streamText>)
}

afterEach(() => {
  streamTextMock.mockReset()
  createAnthropicMock.mockClear()
  createOllamaMock.mockClear()
  convertToModelMessagesMock.mockClear()
})

describe('POST /api/chat', () => {
  it('should reject Anthropic requests with no Authorization header', async () => {
    const response = await POST(
      buildRequest({ authorization: null }) as Parameters<typeof POST>[0],
    )
    expect(response.status).toBe(401)
  })

  it('should route through Ollama when provider header is set, no key required', async () => {
    mockStreamResult()
    const response = await POST(
      buildRequest({
        authorization: null,
        provider: 'ollama',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    expect(createOllamaMock).toHaveBeenCalledTimes(1)
    expect(createAnthropicMock).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it('rejects requests with malformed body', async () => {
    const response = await POST(
      buildRequest({ body: { foo: 'bar' } }) as Parameters<typeof POST>[0],
    )
    expect(response.status).toBe(400)
  })

  it('passes Authorization key to createAnthropic and streams response', async () => {
    mockStreamResult()
    const response = await POST(
      buildRequest({
        authorization: 'Bearer sk-ant-abc',
        body: { messages: [], profile: 'I want Stockholm AI roles' },
      }) as Parameters<typeof POST>[0],
    )

    expect(createAnthropicMock).toHaveBeenCalledWith({ apiKey: 'sk-ant-abc' })
    expect(streamTextMock).toHaveBeenCalledTimes(1)
    const callArg = streamTextMock.mock.calls[0][0] as { system: string }
    expect(callArg.system).toContain('I want Stockholm AI roles')
    expect(response.status).toBe(200)
    expect(response.headers.get('x-stream')).toBe('1')
  })

  it('omits the profile block when no profile is supplied', async () => {
    mockStreamResult()
    await POST(
      buildRequest({
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    const callArg = streamTextMock.mock.calls[0][0] as { system: string }
    expect(callArg.system).not.toContain('USER PROFILE')
  })
})
