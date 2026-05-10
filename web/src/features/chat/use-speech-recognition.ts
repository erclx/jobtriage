'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

const noopSubscribe = () => () => {}

interface SpeechRecognitionAlternative {
  readonly transcript: string
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item: (index: number) => SpeechRecognitionAlternative
  readonly [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  item: (index: number) => SpeechRecognitionResult
  readonly [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as SpeechRecognitionWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type SpeechRecognitionError = 'denied' | 'no-speech' | 'unknown'

interface SpeechRecognitionTranscript {
  readonly final: string
  readonly interim: string
}

export interface UseSpeechRecognitionOptions {
  readonly onTranscript: (transcript: SpeechRecognitionTranscript) => void
  readonly onError?: (error: SpeechRecognitionError) => void
}

export interface UseSpeechRecognitionResult {
  readonly isSupported: boolean
  readonly isListening: boolean
  readonly start: () => void
  readonly stop: () => void
  readonly abort: () => void
}

export function useSpeechRecognition({
  onTranscript,
  onError,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const isSupported = useSyncExternalStore(
    noopSubscribe,
    () => getConstructor() !== null,
    () => false,
  )
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onErrorRef.current = onError
  }, [onTranscript, onError])

  useEffect(
    () => () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    },
    [],
  )

  const start = useCallback(() => {
    const Ctor = getConstructor()
    if (!Ctor) return
    if (recognitionRef.current) return

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang =
      typeof navigator !== 'undefined' && navigator.language
        ? navigator.language
        : 'en-US'

    recognition.onresult = (event) => {
      let final = ''
      let interim = ''
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const alternative = result[0]
        if (!alternative) continue
        if (result.isFinal) {
          final += alternative.transcript
        } else {
          interim += alternative.transcript
        }
      }
      onTranscriptRef.current({ final, interim })
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
      ) {
        onErrorRef.current?.('denied')
      } else if (event.error === 'no-speech') {
        onErrorRef.current?.('no-speech')
      } else {
        onErrorRef.current?.('unknown')
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    } catch {
      recognitionRef.current = null
      setIsListening(false)
    }
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const abort = useCallback(() => {
    recognitionRef.current?.abort()
  }, [])

  return { abort, isListening, isSupported, start, stop }
}
