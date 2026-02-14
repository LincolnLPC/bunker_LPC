"use client"

import { useCallback, useRef, useEffect } from "react"

/**
 * Возвращает debounced-версию callback: вызов откладывается на delay мс,
 * при повторных вызовах таймер сбрасывается.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
): T {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastArgsRef = useRef<Parameters<T> | null>(null)

  callbackRef.current = callback

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  return useCallback(
    ((...args: Parameters<T>) => {
      lastArgsRef.current = args
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        callbackRef.current(...(lastArgsRef.current ?? []))
      }, delay)
    }) as T,
    [delay],
  )
}
