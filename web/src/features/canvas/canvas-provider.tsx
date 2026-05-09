'use client'

import { useEffect, useMemo, useReducer, useRef } from 'react'

import {
  type CanvasAction,
  CanvasContext,
  canvasReducer,
  type CanvasState,
  INITIAL_CANVAS_STATE,
} from '@/features/canvas/canvas-state'
import { SESSION_KEYS } from '@/features/chat/storage-keys'

interface CanvasProviderProps {
  readonly children: React.ReactNode
}

const isBrowser = typeof window !== 'undefined'

function readPersisted(): CanvasState | null {
  if (!isBrowser) return null
  const raw = window.sessionStorage.getItem(SESSION_KEYS.canvas)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CanvasState>
    return { ...INITIAL_CANVAS_STATE, ...parsed }
  } catch {
    return null
  }
}

export function CanvasProvider({ children }: CanvasProviderProps) {
  const [state, dispatch] = useReducer(canvasReducer, INITIAL_CANVAS_STATE)
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const persisted = readPersisted()
    if (persisted) {
      dispatch({ type: 'hydrate', state: persisted })
    }
  }, [])

  useEffect(() => {
    if (!isBrowser || !hydrated.current) return
    try {
      window.sessionStorage.setItem(SESSION_KEYS.canvas, JSON.stringify(state))
    } catch {
      // sessionStorage quota or serialization failure: stay in-memory.
    }
  }, [state])

  const value = useMemo(
    () => ({
      state,
      dispatch: dispatch as (action: CanvasAction) => void,
    }),
    [state],
  )

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  )
}
