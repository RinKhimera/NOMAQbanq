import { useCallback, useEffect, useRef } from "react"

type Anchor = { at: number; startedAt: number }

/**
 * Écart au-delà duquel une nouvelle ancre serveur est adoptée. En deçà, c'est
 * le demi-RTT d'une réponse d'action : reposer le delta à chaque réponse ferait
 * sauter le chrono d'une seconde dans un sens ou l'autre.
 */
const RESYNC_THRESHOLD_MS = 2000

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
 * serveur le crédite).
 *
 * L'horloge monotone ne court pas pendant la veille du système, et un retour
 * arrière remonte le composant sur un instant serveur périmé : toute nouvelle
 * valeur de `anchorNow` (instant renvoyé par une action) réaligne le delta dès
 * qu'elle s'écarte de plus de `RESYNC_THRESHOLD_MS` de l'horloge courante.
 */
export function useAnchoredClock(anchorNow: number): () => number {
  const anchorRef = useRef<Anchor | null>(null)

  const read = useCallback((anchor: Anchor) => {
    return anchor.at + (performance.now() - anchor.startedAt)
  }, [])

  useEffect(() => {
    const current = anchorRef.current
    if (current && Math.abs(anchorNow - read(current)) < RESYNC_THRESHOLD_MS) {
      return
    }
    anchorRef.current = { at: anchorNow, startedAt: performance.now() }
  }, [anchorNow, read])

  return useCallback(() => {
    anchorRef.current ??= { at: anchorNow, startedAt: performance.now() }
    return read(anchorRef.current)
  }, [anchorNow, read])
}
