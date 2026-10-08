import { afterEach, vi } from "vitest"

// `restoreMocks` ne rend pas l'horloge : sans ce reset, un `vi.useFakeTimers()`
// oublie fige `Date` et `setTimeout` pour tous les tests suivants du fichier.
afterEach(() => {
  vi.useRealTimers()
})
