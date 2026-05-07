'use client'

import { CpuIcon, KeyRoundIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OLLAMA_MARKER, SESSION_KEYS } from '@/features/chat/storage-keys'
import { useSessionValue } from '@/features/chat/use-session-value'

interface ApiKeyGateProps {
  children: ReactNode
}

export function ApiKeyGate({ children }: ApiKeyGateProps) {
  const [storedKey, setStoredKey] = useSessionValue(SESSION_KEYS.apiKey)
  const [storedProvider, setStoredProvider] = useSessionValue(
    SESSION_KEYS.provider,
  )
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (storedProvider === 'ollama' || storedKey) {
    return <>{children}</>
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
  }

  function handleUseOllama() {
    setStoredProvider(OLLAMA_MARKER)
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
              jobtriage routes your chat through Claude with the key you supply.
              Held in this browser tab&apos;s sessionStorage and sent only to
              the jobtriage server route. Never persisted on disk.
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

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleUseOllama}
        >
          <CpuIcon className="size-4" aria-hidden />
          Use local Ollama (gemma4-26b-64k)
        </Button>
      </div>
    </div>
  )
}
