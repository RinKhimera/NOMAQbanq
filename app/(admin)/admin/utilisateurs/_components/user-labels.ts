import { getAccessStatus } from "@/components/shared/payments/access-badge"
import { toAppZoneCalendarDay } from "@/lib/app-zone"
import { formatDayMonth, formatMediumDate } from "@/lib/format"

// Règles d'affichage des comptes (liste et fiche), sans état ni rendu.

const DAY_MS = 24 * 60 * 60 * 1000
const NB = " "

export type AccessState =
  | { state: "never" }
  | { state: "expired"; expiresAt: number }
  | { state: "expiring" | "active"; expiresAt: number; days: number }

/** État d'un accès lu dans `user_access` ; le seuil « expire bientôt » est celui de `getAccessStatus`. */
export const accessState = (
  expiresAt: number | null,
  now: number,
): AccessState => {
  if (expiresAt === null) return { state: "never" }
  if (expiresAt <= now) return { state: "expired", expiresAt }
  const days = Math.ceil((expiresAt - now) / DAY_MS)
  const state = getAccessStatus(expiresAt, days)
  return {
    state: state === "expiring" ? "expiring" : "active",
    expiresAt,
    days,
  }
}

/** Cellule d'accès de la liste : « 20 j restants », « Expire dans 3 j », « Expiré 17 sept. », « — ». */
export const accessCellText = (a: AccessState): string => {
  switch (a.state) {
    case "never":
      return "—"
    case "expired":
      return `Expiré ${formatDayMonth(a.expiresAt)}`
    case "expiring":
      return `Expire dans ${a.days}${NB}j`
    case "active":
      return `${a.days}${NB}j restants`
  }
}

/** « Non défini » pour un compte sans nom. */
export const userLabel = (name: string) => name.trim() || "Non défini"

/**
 * Journée où `user.last_login_at` a été rempli d'office pour tous les comptes
 * (migration 0017, déployée le 6 septembre 2026). Tant que la plupart des
 * comptes portent cette valeur, elle ne distingue personne.
 */
export const LAST_LOGIN_BACKFILL_DAY = "2026-09-06"

export const isBackfilledLogin = (at: number) =>
  toAppZoneCalendarDay(at) === LAST_LOGIN_BACKFILL_DAY

export const backfillDateLabel = () =>
  formatMediumDate(`${LAST_LOGIN_BACKFILL_DAY}T12:00:00-04:00`)

const LOGIN_METHOD: Record<string, string> = {
  credential: "Mot de passe",
  google: "Google",
}

/** « Mot de passe, Google » depuis `account.provider_id`. */
export const loginMethodsLabel = (providers: string[]) =>
  providers.map((p) => LOGIN_METHOD[p] ?? p).join(", ")
