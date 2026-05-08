'use client'

import { useCallback, useSyncExternalStore } from 'react'

const isBrowser = typeof window !== 'undefined'

const listeners = new Map<string, Set<() => void>>()

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener())
}

function getServerSnapshot(): string {
  return ''
}

export function useSessionValue(
  key: string,
): [string, (next: string) => void, () => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!isBrowser) {
        return () => undefined
      }
      let bucket = listeners.get(key)
      if (!bucket) {
        bucket = new Set()
        listeners.set(key, bucket)
      }
      bucket.add(callback)
      const handleStorage = (event: StorageEvent) => {
        if (event.key === key) callback()
      }
      window.addEventListener('storage', handleStorage)
      return () => {
        bucket.delete(callback)
        window.removeEventListener('storage', handleStorage)
      }
    },
    [key],
  )

  const getSnapshot = useCallback(() => {
    if (!isBrowser) return ''
    return window.sessionStorage.getItem(key) ?? ''
  }, [key])

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const persist = useCallback(
    (next: string) => {
      if (!isBrowser) return
      if (next === '') {
        window.sessionStorage.removeItem(key)
      } else {
        window.sessionStorage.setItem(key, next)
      }
      notify(key)
    },
    [key],
  )

  const clear = useCallback(() => {
    persist('')
  }, [persist])

  return [value, persist, clear]
}
