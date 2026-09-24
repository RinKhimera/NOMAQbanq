import { useCallback, useMemo, useSyncExternalStore } from "react"

/**
 * Choix de colonnes enregistré pour un tableau. `known` liste les colonnes qui
 * existaient au moment du choix : une colonne ajoutée au code depuis n'y figure
 * pas et retombe sur son affichage par défaut au lieu d'être masquée.
 */
export type ColumnPreference = { visible: string[]; known: string[] }

const STORAGE_PREFIX = "data-table:"

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

// Stockage indisponible (navigation privée, données de site bloquées, quota
// plein) : le choix est gardé ici, et vaut jusqu'au rechargement de la page.
const unsavedChoices = new Map<string, string | null>()

function readRaw(key: string): string | null {
  if (unsavedChoices.has(key)) return unsavedChoices.get(key) ?? null
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_PREFIX + key)
    else window.localStorage.setItem(STORAGE_PREFIX + key, value)
    unsavedChoices.delete(key)
  } catch {
    unsavedChoices.set(key, value)
  }
  notify()
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string")

export function parsePreference(raw: string | null): ColumnPreference | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "visible" in parsed &&
      "known" in parsed &&
      isStringArray(parsed.visible) &&
      isStringArray(parsed.known)
    ) {
      return { visible: parsed.visible, known: parsed.known }
    }
  } catch {
    // Valeur corrompue : traitée comme absente.
  }
  return null
}

const getServerSnapshot = () => null

/**
 * Préférence de colonnes d'un tableau. Toujours `null` au rendu serveur et à
 * l'hydratation : le tableau y rend ses colonnes par défaut, puis bascule sur le
 * choix enregistré.
 */
export function useColumnPreference(key: string | undefined) {
  const raw = useSyncExternalStore(
    subscribe,
    () => (key ? readRaw(key) : null),
    getServerSnapshot,
  )
  const preference = useMemo(() => parsePreference(raw), [raw])

  const save = useCallback(
    (next: ColumnPreference | null) => {
      if (!key) return
      writeRaw(key, next === null ? null : JSON.stringify(next))
    },
    [key],
  )

  return [preference, save] as const
}
