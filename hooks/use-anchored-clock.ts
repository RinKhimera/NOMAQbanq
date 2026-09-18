import { useCallback, useRef } from "react"

/**
 * Horloge d'une tentative côté client : `now()` = ancre serveur + delta
 * monotone depuis la première lecture. `performance.now()` ignore les
 * réglages de l'horloge système : un navigateur dont l'heure est fausse ne
 * gagne ni ne perd de temps par rapport au serveur — `Date.now()` en avance
 * du budget auto-soumettait l'examen au premier tick.
 *
 * L'ancre se pose à la première lecture, donc jamais pendant le rendu (règle
 * d'hydratation, `.claude/rules/loading-ui.md`) : le premier rendu lit
 * `anchorNow` directement. Une nouvelle ancre (instant serveur plus récent)
 * repose le delta.
 */
export function useAnchoredClock(anchorNow: number): () => number {
  const clockRef = useRef<{ anchor: number; startedAt: number } | null>(null)
  return useCallback(() => {
    if (clockRef.current?.anchor !== anchorNow) {
      clockRef.current = { anchor: anchorNow, startedAt: performance.now() }
    }
    return anchorNow + (performance.now() - clockRef.current.startedAt)
  }, [anchorNow])
}
