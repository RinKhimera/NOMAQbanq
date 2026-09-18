import { useCallback, useEffect, useRef } from "react"

type Anchor = { anchor: number; startedAt: number }

/**
 * Horloge d'une tentative côté client : `now()` = ancre serveur + delta
 * monotone depuis le montage. `performance.now()` ignore les réglages de
 * l'horloge système : un navigateur dont l'heure est fausse ne gagne ni ne
 * perd de temps par rapport au serveur — `Date.now()` en avance du budget
 * auto-soumettait l'examen au premier tick.
 *
 * L'ancre se pose dans un effet, donc jamais pendant le rendu (règle
 * d'hydratation, `.claude/rules/loading-ui.md`) : le premier rendu lit
 * `anchorNow` directement. Elle se pose au MONTAGE, pas à la première
 * lecture : une page rechargée en pause ne lit l'horloge qu'à la reprise, et
 * le temps passé en pause depuis le rendu serveur doit déjà être compté (le
 * serveur le crédite). Une nouvelle ancre (instant serveur plus récent) repose
 * le delta.
 */
export function useAnchoredClock(anchorNow: number): () => number {
  const anchorRef = useRef<Anchor | null>(null)
  useEffect(() => {
    anchorRef.current = { anchor: anchorNow, startedAt: performance.now() }
  }, [anchorNow])
  return useCallback(() => {
    if (anchorRef.current?.anchor !== anchorNow) {
      anchorRef.current = { anchor: anchorNow, startedAt: performance.now() }
    }
    return anchorNow + (performance.now() - anchorRef.current.startedAt)
  }, [anchorNow])
}
