import { format, formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

/**
 * Formate un montant en cents vers une devise lisible
 * XAF: pas de décimales, symbole après le montant
 * CAD: format standard canadien-français
 */
export const formatCurrency = (
  amountCents: number,
  currency = "CAD",
): string => {
  const amount = amountCents / 100

  if (currency === "XAF") {
    // XAF n'a pas de sous-unités, affichage avec espace comme séparateur de milliers
    return (
      new Intl.NumberFormat("fr-FR", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount) + " XAF"
    )
  }

  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formate un timestamp en date lisible
 */
export const formatExpiration = (timestamp: number): string => {
  return format(new Date(timestamp), "d MMMM yyyy", { locale: fr })
}

/**
 * Formate un timestamp en temps relatif
 */
export const formatTimeRemaining = (timestamp: number): string => {
  return formatDistanceToNow(new Date(timestamp), {
    locale: fr,
    addSuffix: true,
  })
}

/**
 * Formate un timestamp en date courte
 */
export const formatShortDate = (timestamp: number): string => {
  return format(new Date(timestamp), "dd/MM/yyyy", { locale: fr })
}

/**
 * Formate un timestamp en date et heure
 */
export const formatDateTime = (timestamp: number): string => {
  return format(new Date(timestamp), "d MMM yyyy à HH:mm", { locale: fr })
}

/**
 * Formate un timestamp en heure uniquement (HH:mm)
 */
export const formatTimeOnly = (timestamp: number): string => {
  return format(new Date(timestamp), "HH:mm", { locale: fr })
}

/** « 3 juil. 2026 » — listes/cards admin. */
export const formatMediumDate = (d: Date | number | string): string => {
  return format(new Date(d), "d MMM yyyy", { locale: fr })
}

/** « 3 juillet 2026 à 14:05 » — panneaux de détail. */
export const formatLongDateTime = (d: Date | number | string): string => {
  return format(new Date(d), "d MMMM yyyy 'à' HH:mm", { locale: fr })
}

/** « 3 juillet 2026 à 14:05 » (variante PPP) — détails examen. */
export const formatFullDateTime = (d: Date | number | string): string => {
  return format(new Date(d), "PPP 'à' HH:mm", { locale: fr })
}

/** « 03/07/2026, 14:05 » — lignes compactes (leaderboard, tables). */
export const formatCompactDateTime = (d: Date | number | string): string => {
  return format(new Date(d), "Pp", { locale: fr })
}
