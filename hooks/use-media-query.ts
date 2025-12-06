"use client"

import { useSyncExternalStore } from "react"

// Fonction pour s'abonner aux changements de media query
const subscribe = (query: string) => (callback: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}

// Fonction pour obtenir le snapshot actuel
const getSnapshot = (query: string) => () => {
  if (typeof window === "undefined") return false
  return window.matchMedia(query).matches
}

// Snapshot pour le serveur (SSR)
const getServerSnapshot = () => false

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    getSnapshot(query),
    getServerSnapshot,
  )
}
