'use client'

import { CpuIcon, KeyRoundIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OLLAMA_MARKER, SESSION_KEYS } from '@/features/chat/storage-keys'
import { useSessionValue } from '@/features/chat/use-session-value'

interface ApiKeyGateProps {
  children: ReactNode
  switchRequested?: boolean
  onResolveSwitch?: () => void
}

export function ApiKeyGate({
  children,
  switchRequested = false,
  onResolveSwitch,
}: ApiKeyGateProps) {
  const [storedKey, setStoredKey] = useSessionValue(SESSION_KEYS.apiKey)
  const [storedProvider, setStoredProvider] = useSessionValue(
    SESSION_KEYS.provider,
  )
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  const hasStoredProvider = storedProvider === 'ollama' || Boolean(storedKey)
  const showGate = !hasStoredProvider || switchRequested
  const isSwitchOverlay = switchRequested && hasStoredProvider

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('Paste your Anthropic API key.')
      return
    }
    if (!trimmed.startsWith('sk-ant-')) {
      setError('Anthropic keys start with sk-ant-.')
      return
    }
    setError(null)
    setStoredProvider('anthropic')
    setStoredKey(trimmed)
    resolveSwitch()
  }

  function handleUseOllama() {
    setStoredProvider(OLLAMA_MARKER)
    resolveSwitch()
  }

  function handleCancelSwitch() {
    setDraft('')
    setError(null)
    resolveSwitch()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        <form
          className="space-y-5 rounded-lg border bg-card p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <header className="space-y-2">
            <div className="inline-flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <KeyRoundIcon className="size-5" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold">
              Bring your own Anthropic key
            </h1>
            <p className="text-sm text-muted-foreground">
              Held in this browser tab and sent only to the jobtriage server.
              Never written to disk.
            </p>
          </header>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="anthropic-key"
            >
              Anthropic API key
            </label>
            <Input
              ref={inputRef}
              id="anthropic-key"
              type="password"
              inputMode="text"
              autoComplete="off"
              placeholder="sk-ant-..."
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                if (error) setError(null)
              }}
              onBlur={() => {
                const trimmed = draft.trim()
                if (trimmed && !trimmed.startsWith('sk-ant-')) {
                  setError('Anthropic keys start with sk-ant-.')
                }
              }}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'anthropic-key-error' : undefined}
            />
            {error ? (
              <p
                id="anthropic-key-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Get a key at console.anthropic.com.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full">
            Start chat
          </Button>
        </form>

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
            Requires Ollama with qwen3-coder:30b on localhost:11434.
          </p>
        </div>

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
