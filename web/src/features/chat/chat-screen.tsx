'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { LogOutIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStickToBottomContext } from 'use-stick-to-bottom'

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/features/chat/empty-state'
import { isToolPart } from '@/features/chat/is-tool-part'
import { ProfileDrawer } from '@/features/chat/profile-drawer'
import { SESSION_KEYS } from '@/features/chat/storage-keys'
import { ToolTrace } from '@/features/chat/tool-trace'
import { useSessionValue } from '@/features/chat/use-session-value'

const isBrowser = typeof window !== 'undefined'

function readApiKey(): string {
  if (!isBrowser) return ''
  return window.sessionStorage.getItem(SESSION_KEYS.apiKey) ?? ''
}

function readProvider(): string {
  if (!isBrowser) return 'anthropic'
  return window.sessionStorage.getItem(SESSION_KEYS.provider) ?? 'anthropic'
}

let latestProfile = ''

function getRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'x-jobtriage-provider': readProvider(),
  }
  const key = readApiKey()
  if (key) headers.authorization = `Bearer ${key}`
  return headers
}

function getRequestBody(): { profile: string | null } {
  return { profile: latestProfile || null }
}

export function ChatScreen() {
  const [, , clearStoredKey] = useSessionValue(SESSION_KEYS.apiKey)
  const [, , clearStoredProvider] = useSessionValue(SESSION_KEYS.provider)
  const [storedProfile] = useSessionValue(SESSION_KEYS.profile)

  const handleResetProvider = useCallback(() => {
    clearStoredKey()
    clearStoredProvider()
  }, [clearStoredKey, clearStoredProvider])

  useEffect(() => {
    latestProfile = storedProfile
  }, [storedProfile])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: getRequestHeaders,
        body: getRequestBody,
      }),
    [],
  )

  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
  })

  const [input, setInput] = useState('')
  const isStreaming = status === 'submitted' || status === 'streaming'

  const handleSeed = useCallback(
    (text: string) => {
      void sendMessage({ text })
    },
    [sendMessage],
  )

  const handleProfileChange = useCallback((next: string) => {
    latestProfile = next
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">jobtriage</h1>
          <p className="text-xs text-muted-foreground">
            Free-form chat over Swedish JobTech ads
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetProvider}
          >
            <LogOutIcon className="size-4" aria-hidden />
            Switch provider
          </Button>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-4">
        <div className="shrink-0">
          <ProfileDrawer onProfileChange={handleProfileChange} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
          {messages.length === 0 ? (
            <div className="flex-1">
              <EmptyState onSelect={handleSeed} />
            </div>
          ) : (
            <Conversation className="flex-1">
              <ConversationContent className="pb-8">
                {messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      {message.parts.map((part, index) => {
                        if (part.type === 'text') {
                          return (
                            <MessageResponse key={`${message.id}-${index}`}>
                              {part.text}
                            </MessageResponse>
                          )
                        }
                        if (isToolPart(part)) {
                          return (
                            <ToolTrace
                              key={`${message.id}-${index}`}
                              part={part}
                            />
                          )
                        }
                        return null
                      })}
                    </MessageContent>
                  </Message>
                ))}
              </ConversationContent>
              <StreamingAutoScroll messages={messages} />
              <ConversationScrollButton />
            </Conversation>
          )}

          {error ? (
            <div
              role="alert"
              className="border-t border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive"
            >
              {error.message}
            </div>
          ) : null}

          <div className="shrink-0 border-t p-3">
            <PromptInput
              onSubmit={(message) => {
                const text = message.text.trim()
                if (!text) return
                void sendMessage({ text })
                setInput('')
              }}
            >
              <PromptInputBody>
                <PromptInputTextarea
                  value={input}
                  placeholder="Ask about Swedish job ads..."
                  onChange={(event) => setInput(event.target.value)}
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools />
                <PromptInputSubmit
                  status={status}
                  disabled={!isStreaming && input.trim() === ''}
                  onClick={isStreaming ? () => stop() : undefined}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StreamingAutoScrollProps {
  messages: readonly UIMessage[]
}

function StreamingAutoScroll({ messages }: StreamingAutoScrollProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  const fingerprint = useMemo(
    () =>
      messages
        .map((message) =>
          message.parts
            .map((part) => {
              if (part.type === 'text') return `t:${part.text.length}`
              if ('state' in part) return `s:${String(part.state)}`
              return part.type
            })
            .join('|'),
        )
        .join('||'),
    [messages],
  )

  useEffect(() => {
    if (isAtBottom) {
      void scrollToBottom()
    }
  }, [fingerprint, isAtBottom, scrollToBottom])

  return null
}
