import { TZDate } from "@date-fns/tz"
import { format, formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

/**
 * Fuseau de référence de la plateforme (Québec). `format()` de date-fns rend
 * dans le fuseau du runtime : serveur en UTC (TZ=UTC en prod/CI) vs navigateur
 * en heure locale → la même date sort différente au SSR et à l'hydratation
 * (mismatch React, arbre régénéré). Ancrer le fuseau rend la chaîne stable des
 * deux côtés, et une échéance d'examen désigne le même instant pour tous.
 */
const APP_TIME_ZONE = "America/Toronto"

/**
 * Une chaîne date-only (`"2026-07-03"`) est parsée en minuit **UTC** par
 * `new Date()`, donc rendue la veille en heure de l'Est. Ne passer ici que des
 * instants réels (timestamp, `Date`, ISO complet).
 */
const inAppZone = (d: Date | number | string) =>
  new TZDate(new Date(d), APP_TIME_ZONE)

/**
 * L'heure affichée est un mur-horloge de l'Est, pas l'heure locale du lecteur.
 * Sans cette mention, un utilisateur hors Québec lit l'échéance dans son propre
 * fuseau et se trompe de plusieurs heures sur la fermeture d'un examen.
 */
export const APP_TIME_ZONE_LABEL = "heure de l'Est"

/**
 * Heure du jour (0-23) dans le fuseau de la plateforme. Brancher sur
 * `new Date().getHours()` lit l'heure du RUNTIME — serveur en UTC vs navigateur
 * en heure locale — et fait diverger un texte conditionnel entre le SSR et
 * l'hydratation (post-mortem NOMAQBANQ-5 : salutation du tableau de bord, qui
 * cassait l'hydratation 12 h sur 24 en heure avancée).
 */
export const getAppZoneHour = (d: Date | number | string): number =>
  inAppZone(d).getHours()

/** Année civile dans le fuseau de la plateforme — même piège que `getAppZoneHour`. */
export const getAppZoneYear = (d: Date | number | string): number =>
  inAppZone(d).getFullYear()

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
  return format(inAppZone(timestamp), "d MMMM yyyy", { locale: fr })
}

/**
 * Formate un timestamp en temps relatif
 */
export const formatTimeRemaining = (timestamp: number): string => {
  // Un écart entre deux instants ne dépend pas du fuseau : pas d'ancrage ici.
  return formatDistanceToNow(new Date(timestamp), {
    locale: fr,
    addSuffix: true,
  })
}

/**
 * Formate un timestamp en date courte
 */
export const formatShortDate = (timestamp: number): string => {
  return format(inAppZone(timestamp), "dd/MM/yyyy", { locale: fr })
}

/**
 * Formate un timestamp en date et heure
 */
export const formatDateTime = (timestamp: number): string => {
  return format(inAppZone(timestamp), "d MMM yyyy à HH:mm", { locale: fr })
}

/**
 * Formate un timestamp en heure uniquement (HH:mm)
 */
export const formatTimeOnly = (timestamp: number): string => {
  return format(inAppZone(timestamp), "HH:mm", { locale: fr })
}

/** « 3 juil. 2026 » — listes/cards admin. */
export const formatMediumDate = (d: Date | number | string): string => {
  return format(inAppZone(d), "d MMM yyyy", { locale: fr })
}

/** « 3 juillet 2026 à 14:05 » — panneaux de détail. */
export const formatLongDateTime = (d: Date | number | string): string => {
  return format(inAppZone(d), "d MMMM yyyy 'à' HH:mm", { locale: fr })
}

/** « 3 juillet 2026 à 14:05 » (variante PPP) — détails examen. */
export const formatFullDateTime = (d: Date | number | string): string => {
  return format(inAppZone(d), "PPP 'à' HH:mm", { locale: fr })
}

/**
 * « 3 juillet 2026 à 14:05 (heure de l'Est) » — bornes d'une fenêtre d'examen
 * (ouverture, fermeture). À utiliser partout où le lecteur pourrait confondre
 * l'heure affichée avec la sienne et se tromper d'échéance.
 */
export const formatDeadline = (d: Date | number | string): string =>
  `${formatFullDateTime(d)} (${APP_TIME_ZONE_LABEL})`

/** « 03/07/2026, 14:05 » — lignes compactes (leaderboard, tables). */
export const formatCompactDateTime = (d: Date | number | string): string => {
  return format(inAppZone(d), "Pp", { locale: fr })
}

/** « 03 juil. 2026 » (jour zéro-préfixé) — boutons d'ouverture d'examen. */
export const formatPaddedMediumDate = (d: Date | number | string): string => {
  return format(inAppZone(d), "dd MMM yyyy", { locale: fr })
}

/** « vendredi 3 juillet 2026 » — sous-titres de page. */
export const formatWeekdayLongDate = (d: Date | number | string): string => {
  return format(inAppZone(d), "EEEE d MMMM yyyy", { locale: fr })
}
