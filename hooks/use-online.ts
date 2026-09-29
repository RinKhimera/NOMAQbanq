"use client"

import { useSyncExternalStore } from "react"

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

/**
 * Connexion du navigateur. `true` au rendu serveur et à l'hydratation : un
 * état lu sur `navigator` seul divergerait entre les deux arbres.
 */
export const useOnline = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
