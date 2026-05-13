'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { LogOutIcon, SparklesIcon, UserRoundIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CanvasBridge } from '@/features/canvas/canvas-bridge'
import { CanvasProvider } from '@/features/canvas/canvas-provider'
import { INITIAL_CANVAS_STATE, useCanvas } from '@/features/canvas/canvas-state'
import { CanvasSurface } from '@/features/canvas/canvas-surface'
import { EmptyState } from '@/features/chat/empty-state'
import { isToolPart } from '@/features/chat/is-tool-part'
import { ProfileDialog } from '@/features/chat/profile-dialog'
import { RailSplitter } from '@/features/chat/rail-splitter'
import { SpatialSummary } from '@/features/chat/spatial-summary'
import {
  RAIL_WIDTH_DEFAULT,
  RAIL_WIDTH_MAX,
  RAIL_WIDTH_MIN,
  SESSION_KEYS,
} from '@/features/chat/storage-keys'
import { ToolTrace } from '@/features/chat/tool-trace'
import { useSessionValue } from '@/features/chat/use-session-value'
import {
  type SpeechRecognitionError,
  useSpeechRecognition,
} from '@/features/chat/use-speech-recognition'
import { VoiceInputButton } from '@/features/chat/voice-input-button'
import { MOCK_PROMPTS } from '@/features/mock/prompts'
import { cn } from '@/lib/utils'

const isBrowser = typeof window !== 'undefined'

const SPATIAL_TOOL_TYPE_PREFIXES = [
  'tool-placeAds',
  'tool-groupAds',
  'tool-connectProfileToAds',
  'tool-pairAdsForCompare',
  'tool-placeAdsOnTimeline',
  'tool-pinToShortlist',
  'tool-markStatus',
  'tool-setView',
] as const

function readApiKey(): string {
  if (!isBrowser) return ''
  return window.sessionStorage.getItem(SESSION_KEYS.apiKey) ?? ''
}

function readProvider(): string {
  if (!isBrowser) return 'anthropic'
  return window.sessionStorage.getItem(SESSION_KEYS.provider) ?? 'anthropic'
}

let latestProfile = ''

function readModeOverride(): string | null {
  if (!isBrowser) return null
  const mode = new URLSearchParams(window.location.search).get('mode')
  return mode === 'deploy' ? 'deploy' : null
}

function getRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'x-jobtriage-provider': readProvider(),
  }
  const key = readApiKey()
  if (key) headers.authorization = `Bearer ${key}`
  const modeOverride = readModeOverride()
  if (modeOverride) headers['x-jobtriage-mode'] = modeOverride
  return headers
}

function getRequestBody(): { profile: string | null } {
  return { profile: latestProfile || null }
}

interface ChatScreenProps {
  readonly onSwitchProvider?: () => void
}

export function ChatScreen({ onSwitchProvider }: ChatScreenProps = {}) {
  return (
    <CanvasProvider>
      <ChatScreenInner onSwitchProvider={onSwitchProvider} />
    </CanvasProvider>
  )
}

function ChatScreenInner({ onSwitchProvider }: ChatScreenProps) {
  const [storedProvider] = useSessionValue(SESSION_KEYS.provider)
  const isMockMode = storedProvider === 'mock'
  const [storedProfile] = useSessionValue(SESSION_KEYS.profile)
  const [storedRailWidth, setStoredRailWidth] = useSessionValue(
    SESSION_KEYS.railWidth,
  )
  const { state: canvasState, dispatch: dispatchCanvas } = useCanvas()
  const [profileOpen, setProfileOpen] = useState(false)
  const [confirmNewChatOpen, setConfirmNewChatOpen] = useState(false)
  const [triedPrompts, setTriedPrompts] = useState<readonly string[]>([])

  const railWidth = useMemo(() => {
    const parsed = Number(storedRailWidth)
    if (!Number.isFinite(parsed) || parsed === 0) return RAIL_WIDTH_DEFAULT
    return clampRail(parsed)
  }, [storedRailWidth])

  const handleRailResize = useCallback(
    (next: number) => {
      setStoredRailWidth(String(clampRail(next)))
    },
    [setStoredRailWidth],
  )

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

  const { messages, sendMessage, setMessages, status, error, stop } = useChat({
    transport,
  })
  const [input, setInput] = useState('')
  const [voiceError, setVoiceError] = useState<SpeechRecognitionError | null>(
    null,
  )
  const voiceBaselineRef = useRef('')
  const inputRef = useRef('')
  useEffect(() => {
    inputRef.current = input
  }, [input])

  const handleVoiceTranscript = useCallback(
    ({ final, interim }: { final: string; interim: string }) => {
      const baseline = voiceBaselineRef.current
      const prefix = baseline ? `${baseline.replace(/\s+$/, '')} ` : ''
      const tail = `${final}${interim}`.replace(/^\s+/, '')
      setInput(`${prefix}${tail}`)
    },
    [],
  )

  const {
    isSupported: isVoiceSupported,
    isListening: isVoiceListening,
    start: startVoice,
    stop: stopVoice,
    abort: abortVoice,
  } = useSpeechRecognition({
    onError: setVoiceError,
    onTranscript: handleVoiceTranscript,
  })

  const handleVoiceToggle = useCallback(() => {
    if (isVoiceListening) {
      stopVoice()
      return
    }
    setVoiceError(null)
    voiceBaselineRef.current = inputRef.current
    startVoice()
  }, [isVoiceListening, startVoice, stopVoice])

  useEffect(() => {
    if (!isVoiceListening) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      abortVoice()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVoiceListening, abortVoice])

  const isStreaming = status === 'submitted' || status === 'streaming'
  const isEmpty = messages.length === 0

  const chatHydratedRef = useRef(false)
  useEffect(() => {
    if (chatHydratedRef.current) return
    chatHydratedRef.current = true
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem(SESSION_KEYS.chat)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as UIMessage[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed)
      }
    } catch {
      // bad payload, drop it
    }
  }, [setMessages])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (status !== 'ready') return
    if (!chatHydratedRef.current) return
    try {
      if (messages.length === 0) {
        window.sessionStorage.removeItem(SESSION_KEYS.chat)
      } else {
        window.sessionStorage.setItem(
          SESSION_KEYS.chat,
          JSON.stringify(messages),
        )
      }
    } catch {
      // sessionStorage quota or serialization failure: stay in-memory
    }
  }, [messages, status])

  const [, setStoredProfile] = useSessionValue(SESSION_KEYS.profile)
  const handleSeed = useCallback(
    (text: string) => {
      if (isMockMode) {
        const match = MOCK_PROMPTS.find((entry) => entry.prompt === text)
        if (match) {
          setStoredProfile(match.profile)
          latestProfile = match.profile
        }
      }
      void sendMessage({ text })
    },
    [isMockMode, sendMessage, setStoredProfile],
  )

  const handleMockChipClick = useCallback(
    (text: string) => {
      setMessages([])
      dispatchCanvas({ type: 'hydrate', state: INITIAL_CANVAS_STATE })
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(SESSION_KEYS.chat)
        window.sessionStorage.removeItem(SESSION_KEYS.canvas)
      }
      setTriedPrompts((prev) => (prev.includes(text) ? prev : [...prev, text]))
      handleSeed(text)
    },
    [dispatchCanvas, handleSeed, setMessages],
  )

  const handleResetDemo = useCallback(() => {
    setMessages([])
    dispatchCanvas({ type: 'hydrate', state: INITIAL_CANVAS_STATE })
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_KEYS.chat)
      window.sessionStorage.removeItem(SESSION_KEYS.canvas)
    }
    setTriedPrompts([])
  }, [dispatchCanvas, setMessages])

  const handleProfileChange = useCallback((next: string) => {
    latestProfile = next
  }, [])

  const handleSwitchProvider = useCallback(() => {
    onSwitchProvider?.()
  }, [onSwitchProvider])

  const handleEditProfile = useCallback(() => setProfileOpen(true), [])

  const handleNewChatRequest = useCallback(() => {
    setConfirmNewChatOpen(true)
  }, [])

  const handleNewChatConfirm = useCallback(() => {
    setMessages([])
    dispatchCanvas({ type: 'hydrate', state: INITIAL_CANVAS_STATE })
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_KEYS.chat)
      window.sessionStorage.removeItem(SESSION_KEYS.canvas)
    }
    setTriedPrompts([])
    setConfirmNewChatOpen(false)
  }, [setMessages, dispatchCanvas])

  const promptInput = (
    <div className="flex flex-col gap-1">
      {voiceError ? (
        <p role="status" className="px-1 text-xs text-destructive">
          {voiceErrorMessage(voiceError)}
        </p>
      ) : null}
      <PromptInput
        className="chat-prompt-input"
        onSubmit={(message) => {
          if (isMockMode) {
            handleSwitchProvider()
            return
          }
          const text = message.text.trim()
          if (!text) return
          stopVoice()
          void sendMessage({ text })
          setInput('')
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea
            value={isMockMode ? '' : input}
            placeholder={
              isMockMode
                ? 'Paste a key to ask your own question.'
                : 'Ask about Swedish job ads...'
            }
            onChange={(event) => {
              if (isMockMode) return
              setInput(event.target.value)
            }}
            readOnly={isMockMode}
            aria-disabled={isMockMode}
            tabIndex={isMockMode ? -1 : 0}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {isMockMode ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleSwitchProvider}
              >
                Switch to BYOK
              </Button>
            ) : (
              <VoiceInputButton
                isSupported={isVoiceSupported}
                isListening={isVoiceListening}
                onToggle={handleVoiceToggle}
              />
            )}
          </PromptInputTools>
          <PromptInputSubmit
            status={status}
            disabled={isMockMode || (!isStreaming && input.trim() === '')}
            onClick={isStreaming ? () => stop() : undefined}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )

  const profileLabel = useMemo(
    () => profileButtonLabel(storedProfile),
    [storedProfile],
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">jobtriage</h1>
          <p className="text-xs text-muted-foreground">
            Live agent triages Swedish job ads against any profile.
          </p>
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleEditProfile}
                  aria-label="Edit profile"
                >
                  <UserRoundIcon className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{profileLabel}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit profile</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleNewChatRequest}
                  disabled={
                    isStreaming ||
                    (isEmpty &&
                      canvasState.visibleAdIds.length === 0 &&
                      canvasState.pinnedAdIds.length === 0)
                  }
                  aria-label="Start a new chat"
                >
                  <SparklesIcon className="size-4" aria-hidden />
                  <span className="hidden sm:inline">New chat</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Start a new chat</TooltipContent>
            </Tooltip>
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSwitchProvider}
                  disabled={isStreaming}
                  aria-label="Switch provider"
                >
                  <LogOutIcon className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Switch provider</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Switch provider</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          style={{ '--rail-width': `${railWidth}px` } as React.CSSProperties}
          className={cn(
            'flex w-full min-w-0 flex-col bg-card',
            'lg:w-[var(--rail-width)] lg:shrink-0',
          )}
        >
          <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground lg:hidden">
            Best viewed on a desktop. The spatial canvas needs at least 1024px.
          </div>

          {error ? (
            <div
              role="alert"
              className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive"
            >
              {error.message}
            </div>
          ) : null}

          {isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
              <EmptyState
                onSelect={isMockMode ? handleMockChipClick : handleSeed}
                mode={isMockMode ? 'mock' : 'default'}
                mockPrompts={MOCK_PROMPTS}
              />
              <div className="w-full">{promptInput}</div>
            </div>
          ) : (
            <>
              <Conversation className="flex-1">
                <ConversationContent className="px-3 pb-6 pt-3">
                  {messages.map((message) => (
                    <Message from={message.role} key={message.id}>
                      <MessageContent
                        className={
                          message.role === 'assistant' ? 'w-full' : undefined
                        }
                      >
                        {message.parts.map((part, index) => {
                          if (part.type === 'text') {
                            return (
                              <MessageResponse key={`${message.id}-${index}`}>
                                {part.text}
                              </MessageResponse>
                            )
                          }
                          if (isToolPart(part)) {
                            if (isSpatialToolPart(part as { type: string })) {
                              return (
                                <SpatialSummary
                                  key={`${message.id}-${index}`}
                                  part={part}
                                />
                              )
                            }
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

              <div className="shrink-0 border-t p-3">
                {isMockMode ? (
                  <MockChipStrip
                    triedPrompts={triedPrompts}
                    isStreaming={isStreaming}
                    onSelect={handleMockChipClick}
                    onReset={handleResetDemo}
                    onSwitchProvider={handleSwitchProvider}
                  />
                ) : null}
                {promptInput}
              </div>
            </>
          )}
        </aside>

        <RailSplitter
          minWidth={RAIL_WIDTH_MIN}
          maxWidth={RAIL_WIDTH_MAX}
          currentWidth={railWidth}
          onResize={handleRailResize}
        />

        <section className="hidden min-w-0 flex-1 lg:block">
          <CanvasSurface onEditProfile={handleEditProfile} />
        </section>
      </div>

      <CanvasBridge messages={messages} />
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onProfileChange={handleProfileChange}
      />
      <Dialog open={confirmNewChatOpen} onOpenChange={setConfirmNewChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start a new chat?</DialogTitle>
            <DialogDescription>
              The conversation, canvas, and pinned shortlist all clear. Your
              profile, provider, and key stay.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmNewChatOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleNewChatConfirm}
            >
              Start new chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function voiceErrorMessage(error: SpeechRecognitionError): string {
  if (error === 'denied')
    return 'Allow microphone access in the browser to use voice input.'
  if (error === 'no-speech')
    return 'No speech detected. Tap the mic and try again.'
  return 'Voice input is unavailable. Try again or type instead.'
}

function profileButtonLabel(profile: string): string {
  const trimmed = profile.trim()
  if (!trimmed) return 'Add profile'
  return `Profile · ${profile.length.toLocaleString()} chars`
}

function clampRail(value: number): number {
  return Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, Math.round(value)))
}

function isSpatialToolPart(part: { type: string }): boolean {
  return SPATIAL_TOOL_TYPE_PREFIXES.some((prefix) => part.type === prefix)
}

interface MockChipStripProps {
  readonly triedPrompts: readonly string[]
  readonly isStreaming: boolean
  readonly onSelect: (prompt: string) => void
  readonly onReset: () => void
  readonly onSwitchProvider: () => void
}

function MockChipStrip({
  triedPrompts,
  isStreaming,
  onSelect,
  onReset,
  onSwitchProvider,
}: MockChipStripProps) {
  const remaining = useMemo(
    () => MOCK_PROMPTS.filter((entry) => !triedPrompts.includes(entry.prompt)),
    [triedPrompts],
  )

  if (remaining.length === 0) {
    return (
      <div className="mb-3 flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs leading-snug text-foreground">
          That is the full demo. Switch to BYOK to ask your own questions, or
          start over to replay any chip.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onSwitchProvider}
            disabled={isStreaming}
            className="flex-1"
          >
            Switch to BYOK
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={isStreaming}
          >
            Start over
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3 flex flex-col gap-1.5">
      <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Try another demo
      </p>
      <div className="flex flex-col gap-1.5">
        {remaining.map((entry) => (
          <button
            key={entry.prompt}
            type="button"
            onClick={() => onSelect(entry.prompt)}
            disabled={isStreaming}
            title={entry.prompt}
            className="cursor-pointer truncate rounded-md border border-border bg-background px-3 py-1.5 text-left text-xs leading-snug text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {entry.chipLabel}
          </button>
        ))}
      </div>
    </div>
  )
}

interface StreamingAutoScrollProps {
  readonly messages: readonly UIMessage[]
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
