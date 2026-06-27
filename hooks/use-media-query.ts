"use client"

import { useCallback, useSyncExternalStore } from "react"

const getServerSnapshot = () => false

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener("change", callback)
      return () => media.removeEventListener("change", callback)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia(query).matches
  }, [query])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
