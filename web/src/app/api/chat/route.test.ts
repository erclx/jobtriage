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
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => () => 'openai-model-handle'),
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => () => 'gemini-model-handle'),
}))
vi.mock('ollama-ai-provider-v2', () => ({
  createOllama: vi.fn(() => () => 'ollama-model-handle'),
}))

import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { convertToModelMessages, streamText } from 'ai'
import { createOllama } from 'ollama-ai-provider-v2'

import { POST } from './route'

const streamTextMock = vi.mocked(streamText)
const createAnthropicMock = vi.mocked(createAnthropic)
const createOpenAIMock = vi.mocked(createOpenAI)
const createGoogleGenerativeAIMock = vi.mocked(createGoogleGenerativeAI)
const createOllamaMock = vi.mocked(createOllama)
const convertToModelMessagesMock = vi.mocked(convertToModelMessages)

const buildRequest = (init: {
  body?: unknown
  authorization?: string | null
  provider?: string
  mode?: string
}): Request => {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (init.authorization !== null) {
    headers.set('authorization', init.authorization ?? 'Bearer sk-ant-test')
  }
  if (init.provider) {
    headers.set('x-jobtriage-provider', init.provider)
  }
  if (init.mode) {
    headers.set('x-jobtriage-mode', init.mode)
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
  createOpenAIMock.mockClear()
  createGoogleGenerativeAIMock.mockClear()
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

  it('should pass num_ctx provider options on the Ollama branch', async () => {
    mockStreamResult()
    await POST(
      buildRequest({
        authorization: null,
        provider: 'ollama',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    const callArg = streamTextMock.mock.calls[0][0] as {
      providerOptions?: { ollama?: { options?: { num_ctx?: number } } }
    }
    expect(callArg.providerOptions?.ollama?.options?.num_ctx).toBe(8192)
  })

  it('should not pass Ollama provider options on the Anthropic branch', async () => {
    mockStreamResult()
    await POST(
      buildRequest({
        authorization: 'Bearer sk-ant-abc',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    const callArg = streamTextMock.mock.calls[0][0] as {
      providerOptions?: unknown
    }
    expect(callArg.providerOptions).toBeUndefined()
  })

  it('should register the deploy tool subset on the Anthropic branch', async () => {
    mockStreamResult()
    await POST(
      buildRequest({
        authorization: 'Bearer sk-ant-abc',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    const callArg = streamTextMock.mock.calls[0][0] as {
      tools: Record<string, unknown>
    }
    const toolNames = Object.keys(callArg.tools)
    expect(toolNames).toContain('lookupConcept')
    expect(toolNames).toContain('searchJobs')
    expect(toolNames).toContain('matchProfile')
    expect(toolNames).toContain('compareRoles')
    expect(toolNames).toContain('trackStatus')
    expect(toolNames).not.toContain('semanticSearch')
    expect(toolNames).not.toContain('triageBatch')
    expect(toolNames).not.toContain('deadlineWatch')
  })

  it('should register the local tool subset on the Ollama branch by default', async () => {
    mockStreamResult()
    await POST(
      buildRequest({
        authorization: null,
        provider: 'ollama',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    const callArg = streamTextMock.mock.calls[0][0] as {
      tools: Record<string, unknown>
    }
    const toolNames = Object.keys(callArg.tools)
    expect(toolNames).toContain('semanticSearch')
    expect(toolNames).toContain('triageBatch')
    expect(toolNames).toContain('deadlineWatch')
    expect(toolNames).not.toContain('lookupConcept')
  })

  it('should honor x-jobtriage-mode: deploy on the Ollama branch when not on Vercel', async () => {
    mockStreamResult()
    await POST(
      buildRequest({
        authorization: null,
        provider: 'ollama',
        mode: 'deploy',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    const callArg = streamTextMock.mock.calls[0][0] as {
      tools: Record<string, unknown>
    }
    const toolNames = Object.keys(callArg.tools)
    expect(toolNames).toContain('lookupConcept')
    expect(toolNames).not.toContain('triageBatch')
  })

  it('should reject OpenAI requests with no Authorization header', async () => {
    const response = await POST(
      buildRequest({
        authorization: null,
        provider: 'openai',
      }) as Parameters<typeof POST>[0],
    )
    expect(response.status).toBe(401)
  })

  it('should reject Gemini requests with no Authorization header', async () => {
    const response = await POST(
      buildRequest({
        authorization: null,
        provider: 'gemini',
      }) as Parameters<typeof POST>[0],
    )
    expect(response.status).toBe(401)
  })

  it('should route through createOpenAI when provider is openai', async () => {
    mockStreamResult()
    const response = await POST(
      buildRequest({
        authorization: 'Bearer sk-openai-test',
        provider: 'openai',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    expect(createOpenAIMock).toHaveBeenCalledWith({ apiKey: 'sk-openai-test' })
    expect(createAnthropicMock).not.toHaveBeenCalled()
    expect(createGoogleGenerativeAIMock).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it('should route through createGoogleGenerativeAI when provider is gemini', async () => {
    mockStreamResult()
    const response = await POST(
      buildRequest({
        authorization: 'Bearer AIza-test',
        provider: 'gemini',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    expect(createGoogleGenerativeAIMock).toHaveBeenCalledWith({
      apiKey: 'AIza-test',
    })
    expect(createAnthropicMock).not.toHaveBeenCalled()
    expect(createOpenAIMock).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it('should reject unknown provider strings with 400', async () => {
    const response = await POST(
      buildRequest({
        authorization: 'Bearer something',
        provider: 'cohere',
      }) as Parameters<typeof POST>[0],
    )
    expect(response.status).toBe(400)
  })

  it('should register the deploy tool subset on the OpenAI branch', async () => {
    mockStreamResult()
    await POST(
      buildRequest({
        authorization: 'Bearer sk-openai-test',
        provider: 'openai',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    const callArg = streamTextMock.mock.calls[0][0] as {
      tools: Record<string, unknown>
    }
    const toolNames = Object.keys(callArg.tools)
    expect(toolNames).toContain('lookupConcept')
    expect(toolNames).toContain('searchJobs')
    expect(toolNames).not.toContain('triageBatch')
  })

  it('should register the deploy tool subset on the Gemini branch', async () => {
    mockStreamResult()
    await POST(
      buildRequest({
        authorization: 'Bearer AIza-test',
        provider: 'gemini',
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    const callArg = streamTextMock.mock.calls[0][0] as {
      tools: Record<string, unknown>
    }
    const toolNames = Object.keys(callArg.tools)
    expect(toolNames).toContain('lookupConcept')
    expect(toolNames).toContain('searchJobs')
    expect(toolNames).not.toContain('triageBatch')
  })

  it('should replay a fixture without calling streamText when provider is mock and prompt matches', async () => {
    const response = await POST(
      buildRequest({
        authorization: null,
        provider: 'mock',
        body: {
          messages: [
            {
              id: 'u1',
              role: 'user',
              parts: [
                {
                  type: 'text',
                  text: 'Show me Stockholm AI engineering roles',
                },
              ],
            },
          ],
        },
      }) as Parameters<typeof POST>[0],
    )

    expect(streamTextMock).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Missing body')
    const decoder = new TextDecoder()
    let acc = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      acc += decoder.decode(value)
    }
    expect(acc).toContain('"type":"tool-input-available"')
    expect(acc).toContain('"toolName":"searchJobs"')
    expect(acc).toContain('"type":"tool-output-available"')
    expect(acc.endsWith('data: [DONE]\n\n')).toBe(true)
  })

  it('should fall back to a text-only assistant message when mock prompt does not match a fixture', async () => {
    const response = await POST(
      buildRequest({
        authorization: null,
        provider: 'mock',
        body: {
          messages: [
            {
              id: 'u1',
              role: 'user',
              parts: [{ type: 'text', text: 'free-form unmatched question' }],
            },
          ],
        },
      }) as Parameters<typeof POST>[0],
    )

    expect(streamTextMock).not.toHaveBeenCalled()
    expect(response.status).toBe(200)

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Missing body')
    const decoder = new TextDecoder()
    let acc = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      acc += decoder.decode(value)
    }
    expect(acc.toLowerCase()).toContain('switch to byok')
    expect(acc).not.toContain('tool-input-available')
  })

  it('omits the profile block when no profile is supplied', async () => {
    mockStreamResult()
    await POST(
      buildRequest({
        body: { messages: [] },
      }) as Parameters<typeof POST>[0],
    )

    const callArg = streamTextMock.mock.calls[0][0] as { system: string }
    expect(callArg.system).not.toContain('--- USER PROFILE')
  })
})
