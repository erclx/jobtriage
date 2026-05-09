import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_KEYS } from './storage-keys'

const useChatMock = vi.fn()
vi.mock('@ai-sdk/react', () => ({
  useChat: (options: unknown) => useChatMock(options),
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    DefaultChatTransport: class {
      constructor(_options: unknown) {
        void _options
      }
    },
  }
})

vi.mock('@/components/ai-elements/conversation', () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="conversation">{children}</div>
  ),
  ConversationContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ConversationScrollButton: () => null,
}))

vi.mock('use-stick-to-bottom', () => ({
  useStickToBottomContext: () => ({
    isAtBottom: true,
    scrollToBottom: () => {},
  }),
}))

vi.mock('@/components/ai-elements/message', () => ({
  Message: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="message">{children}</div>
  ),
  MessageContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MessageResponse: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="response">{children}</div>
  ),
}))

vi.mock('@/components/ai-elements/prompt-input', () => ({
  PromptInput: ({
    children,
    onSubmit,
  }: {
    children: React.ReactNode
    onSubmit: (msg: { text: string; files: never[] }) => void
  }) => (
    <form
      data-testid="prompt-input"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        onSubmit({
          text: String(formData.get('message') ?? ''),
          files: [],
        })
      }}
    >
      {children}
    </form>
  ),
  PromptInputBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputTools: () => null,
  PromptInputTextarea: (
    props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  ) => <textarea aria-label="message" name="message" {...props} />,
  PromptInputSubmit: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="submit" {...props}>
      Send
    </button>
  ),
}))

vi.mock('@/features/canvas/canvas-surface', () => ({
  CanvasSurface: () => <div data-testid="canvas-surface" />,
}))

vi.mock('@/features/canvas/canvas-bridge', () => ({
  CanvasBridge: () => null,
}))

import { ChatScreen } from './chat-screen'

describe('ChatScreen', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.sessionStorage.setItem(SESSION_KEYS.apiKey, 'sk-ant-test')
    useChatMock.mockReset()
  })

  afterEach(() => {
    window.sessionStorage.clear()
  })

  function setupChat(
    overrides: {
      messages?: Array<{
        id: string
        role: 'user' | 'assistant'
        parts: Array<
          | { type: 'text'; text: string }
          | {
              type: 'tool-searchJobs'
              state: 'output-available'
              input: unknown
              output: unknown
              toolCallId: string
            }
        >
      }>
      sendMessage?: ReturnType<typeof vi.fn>
      error?: Error
      status?: 'ready' | 'submitted' | 'streaming'
    } = {},
  ) {
    const sendMessage = overrides.sendMessage ?? vi.fn()
    useChatMock.mockReturnValue({
      messages: overrides.messages ?? [],
      sendMessage,
      stop: vi.fn(),
      error: overrides.error,
      status: overrides.status ?? 'ready',
    })
    return { sendMessage }
  }

  it('should show the empty state when there are no messages', () => {
    setupChat()
    render(<ChatScreen />)

    expect(
      screen.getByRole('heading', { name: /Ask jobtriage/i }),
    ).toBeInTheDocument()
  })

  it('should render text parts and the collapsed tool trace, leaving cards to the canvas', () => {
    setupChat({
      messages: [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'looking now' },
            {
              type: 'tool-searchJobs',
              state: 'output-available',
              input: { region: 'STH' },
              output: { results: [] },
              toolCallId: 'call-1',
            },
          ],
        },
      ],
    })

    render(<ChatScreen />)

    expect(screen.getByText('hi')).toBeInTheDocument()
    expect(screen.getByText('looking now')).toBeInTheDocument()
    expect(screen.getByText(/Searched JobTech filter/)).toBeInTheDocument()
  })

  it('should render a one-line summary for spatial tool parts instead of a trace tree', () => {
    setupChat({
      messages: [
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-placeAds',
              state: 'output-available',
              input: { ad_ids: ['ad-1', 'ad-2'], layout: 'grid' },
              output: { accepted: true },
              toolCallId: 'call-spatial',
            } as never,
            { type: 'text', text: 'placed' },
          ],
        },
      ],
    })

    render(<ChatScreen />)

    expect(screen.queryByText(/placeAds/)).not.toBeInTheDocument()
    expect(screen.getByText(/Placed 2 ads on the canvas/)).toBeInTheDocument()
    expect(screen.getByText('placed')).toBeInTheDocument()
  })

  it('should forward prompt submissions to sendMessage with trimmed text', async () => {
    const { sendMessage } = setupChat()
    const user = userEvent.setup()

    render(<ChatScreen />)

    const textarea = screen.getByLabelText('message')
    await user.type(textarea, '  what is up  ')
    await user.click(screen.getByRole('button', { name: /^Send$/ }))

    expect(sendMessage).toHaveBeenCalledWith({ text: 'what is up' })
  })

  it('should forward Switch provider clicks to the parent without clearing storage', async () => {
    setupChat()
    window.sessionStorage.setItem(SESSION_KEYS.provider, 'anthropic')
    const onSwitchProvider = vi.fn()
    const user = userEvent.setup()

    render(<ChatScreen onSwitchProvider={onSwitchProvider} />)

    await user.click(screen.getByRole('button', { name: /Switch provider/i }))

    expect(onSwitchProvider).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(SESSION_KEYS.apiKey)).toBe(
      'sk-ant-test',
    )
  })

  it('should surface the error from useChat', () => {
    setupChat({ error: new Error('Backend down') })

    render(<ChatScreen />)

    expect(screen.getByRole('alert')).toHaveTextContent('Backend down')
  })
})
