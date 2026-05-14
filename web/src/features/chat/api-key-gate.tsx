'use client'

import { CpuIcon, KeyRoundIcon, SparklesIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BYOK_PROVIDERS,
  type ByokProvider,
  getByokProviderMeta,
  MOCK_MARKER,
  OLLAMA_MARKER,
  SESSION_KEYS,
} from '@/features/chat/storage-keys'
import { useSessionValue } from '@/features/chat/use-session-value'
import { cn } from '@/lib/utils'

interface ApiKeyGateProps {
  children: ReactNode
  switchRequested?: boolean
  onResolveSwitch?: () => void
}

const DEFAULT_PROVIDER: ByokProvider = 'anthropic'

function isByokProvider(value: string | null): value is ByokProvider {
  return value === 'anthropic' || value === 'openai' || value === 'gemini'
}

export function ApiKeyGate({
  children,
  switchRequested = false,
  onResolveSwitch,
}: ApiKeyGateProps) {
  const isDeployed = Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV)
  const [storedKey, setStoredKey] = useSessionValue(SESSION_KEYS.apiKey)
  const [storedProvider, setStoredProvider] = useSessionValue(
    SESSION_KEYS.provider,
  )
  const [selectedProvider, setSelectedProvider] = useState<ByokProvider>(() =>
    isByokProvider(storedProvider) ? storedProvider : DEFAULT_PROVIDER,
  )
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [prefixWarning, setPrefixWarning] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  const hasStoredProvider =
    storedProvider === 'ollama' ||
    storedProvider === 'mock' ||
    Boolean(storedKey)
  const showGate = !hasStoredProvider || switchRequested
  const isSwitchOverlay = switchRequested && hasStoredProvider

  const meta = useMemo(
    () => getByokProviderMeta(selectedProvider),
    [selectedProvider],
  )

  useEffect(() => {
    if (!isSwitchOverlay) return

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    inputRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setDraft('')
      setError(null)
      setPrefixWarning(null)
      onResolveSwitch?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus?.()
    }
  }, [isSwitchOverlay, onResolveSwitch])

  if (!showGate) {
    return <>{children}</>
  }

  function resolveSwitch() {
    onResolveSwitch?.()
  }

  function clearSessionState() {
    if (typeof window === 'undefined') return
    window.sessionStorage.removeItem(SESSION_KEYS.chat)
    window.sessionStorage.removeItem(SESSION_KEYS.canvas)
    if (storedProvider === MOCK_MARKER) {
      window.sessionStorage.removeItem(SESSION_KEYS.profile)
    }
  }

  function handleProviderChange(next: ByokProvider) {
    setSelectedProvider(next)
    setError(null)
    setPrefixWarning(null)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) {
      setError(`Paste your ${meta.label} API key.`)
      return
    }
    setError(null)
    setPrefixWarning(null)
    if (isSwitchOverlay) clearSessionState()
    setStoredProvider(selectedProvider)
    setStoredKey(trimmed)
    resolveSwitch()
  }

  function handleUseOllama() {
    if (isSwitchOverlay) clearSessionState()
    setStoredProvider(OLLAMA_MARKER)
    resolveSwitch()
  }

  function handleTryDemo() {
    if (isSwitchOverlay) clearSessionState()
    setStoredProvider(MOCK_MARKER)
    resolveSwitch()
  }

  function handleCancelSwitch() {
    setDraft('')
    setError(null)
    setPrefixWarning(null)
    resolveSwitch()
  }

  const showDemoOnramp = !(isSwitchOverlay && storedProvider === 'mock')

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pb-12 pt-[max(2rem,20vh)]">
      <div className="w-full max-w-md space-y-4">
        {showDemoOnramp ? (
          <>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={handleTryDemo}
            >
              <SparklesIcon className="size-4" aria-hidden />
              Try the demo, no key
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>or bring your own key</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        <form
          className="space-y-5 rounded-lg border bg-card p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <header className="space-y-2">
            <div className="inline-flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <KeyRoundIcon className="size-5" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold">Bring your own API key</h1>
            <p className="text-sm text-muted-foreground">
              Held only in this browser tab. Forwarded with each request to
              drive the agent, never persisted anywhere else.
            </p>
          </header>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Provider
            </legend>
            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label="Provider"
            >
              {BYOK_PROVIDERS.map((option) => {
                const isSelected = selectedProvider === option.id
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <input
                      type="radio"
                      name="byok-provider"
                      value={option.id}
                      checked={isSelected}
                      onChange={() => handleProviderChange(option.id)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="byok-key"
            >
              {meta.label} API key
            </label>
            <Input
              ref={inputRef}
              id="byok-key"
              type="password"
              inputMode="text"
              autoComplete="off"
              placeholder={meta.placeholder}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                if (error) setError(null)
                if (prefixWarning) setPrefixWarning(null)
              }}
              onBlur={() => {
                const trimmed = draft.trim()
                if (
                  trimmed &&
                  meta.prefixHint &&
                  !trimmed.startsWith(meta.prefixHint)
                ) {
                  setPrefixWarning(
                    `Most ${meta.label} keys start with ${meta.prefixHint}.`,
                  )
                } else {
                  setPrefixWarning(null)
                }
              }}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={
                error
                  ? 'byok-key-error'
                  : prefixWarning
                    ? 'byok-key-warning'
                    : 'byok-key-help'
              }
            />
            {error ? (
              <p
                id="byok-key-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : prefixWarning ? (
              <p
                id="byok-key-warning"
                className="text-xs text-amber-600 dark:text-amber-400"
                role="status"
              >
                {prefixWarning}
              </p>
            ) : (
              <p id="byok-key-help" className="text-xs text-muted-foreground">
                <a
                  href={meta.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {meta.signupLabel}
                </a>
                {selectedProvider === 'gemini'
                  ? '. Free tier covers casual use.'
                  : '.'}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full">
            Start chat
          </Button>
        </form>

        {!isDeployed ? (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleUseOllama}
              >
                <CpuIcon className="size-4" aria-hidden />
                Use local Ollama
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Requires Ollama with gemma4:26b on localhost:11434.
              </p>
            </div>
          </>
        ) : null}

        {switchRequested && hasStoredProvider ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleCancelSwitch}
          >
            Cancel and keep current provider
          </Button>
        ) : null}
      </div>
    </div>
  )
}
