'use client'

import { MicIcon, MicOffIcon } from 'lucide-react'

import { PromptInputButton } from '@/components/ai-elements/prompt-input'
import { TooltipProvider } from '@/components/ui/tooltip'

interface VoiceInputButtonProps {
  readonly isSupported: boolean
  readonly isListening: boolean
  readonly onToggle: () => void
}

export function VoiceInputButton({
  isSupported,
  isListening,
  onToggle,
}: VoiceInputButtonProps) {
  if (!isSupported) return null

  return (
    <TooltipProvider delayDuration={200}>
      <PromptInputButton
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
        aria-pressed={isListening}
        onClick={onToggle}
        tooltip={
          isListening
            ? 'Stop voice input'
            : { content: 'Voice input', shortcut: 'Chrome only' }
        }
        variant={isListening ? 'default' : 'ghost'}
      >
        {isListening ? (
          <MicOffIcon className="size-4" aria-hidden />
        ) : (
          <MicIcon className="size-4" aria-hidden />
        )}
      </PromptInputButton>
    </TooltipProvider>
  )
}
