import { format, formatDistanceToNow, isValid, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { inAppZone } from "@/lib/app-zone"

/**
 * Formatage humain des dates et montants. L'arithmétique de fuseau (bornes de
 * journée, mois civils, décalages) vit dans `lib/app-zone.ts` : ce module-ci
 * tire `date-fns` et sa locale française, que le code serveur n'a pas à charger
 * pour calculer une borne de requête. Ne pas ré-exporter les helpers de fuseau
 * d'ici — la frontière ne tient que si les DAL importent `lib/app-zone`.
 */

/**
 * L'heure affichée est un mur-horloge de l'Est, pas l'heure locale du lecteur.
 * Sans cette mention, un utilisateur hors Québec lit l'échéance dans son propre
 * fuseau et se trompe de plusieurs heures sur la fermeture d'un examen.
 */
export const APP_TIME_ZONE_LABEL = "heure de l'Est"

/**
 * Journée civile d'une date issue d'un calendrier, lue dans le fuseau du
 * NAVIGATEUR, comme `formatCalendarDay` et `formatFileTimestamp` : la valeur
 * d'un date picker désigne la case que l'admin vient de cliquer, pas un
 * instant ; un nom de fichier d'export suit l'horloge de celui qui l'enregistre.
 */
export const toCalendarDay = (d: Date): string => format(d, "yyyy-MM-dd")

/** « 3 juil. 2026 » d'une date de calendrier, même lecture que `toCalendarDay`. */
export const formatCalendarDay = (
  d: Date,
  { year = true }: { year?: boolean } = {},
): string => format(d, year ? "d MMM yyyy" : "d MMM", { locale: fr })

/**
 * Jour ISO (`yyyy-MM-dd`) d'une série agrégée par jour : « 3 juil. », ou
 * « vendredi 3 juillet 2026 » en `weekday`. Un jour n'est pas un instant, il
 * n'a pas de fuseau à ancrer.
 */
export const formatIsoDay = (
  iso: string,
  style: "short" | "weekday" = "short",
): string => {
  const day = parseISO(iso)
  if (!isValid(day)) return iso
  return format(day, style === "short" ? "d MMM" : "EEEE d MMMM yyyy", {
    locale: fr,
  })
}

/**
 * Formate un montant en cents vers une devise lisible
 * XAF: pas de décimales, symbole après le montant
 * CAD: format standard canadien-français
 */
export const formatCurrency = (
  amountCents: number,
  currency = "CAD",
  { whole = false }: { whole?: boolean } = {},
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
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount)
}

/**
 * Montant présenté au client par Adaptive Pricing, dans SA devise.
 *
 * Ne pas confondre avec `formatCurrency`, qui divise toujours par 100 parce que
 * l'app stocke ses montants en centièmes. Ici la devise est arbitraire (plus de
 * 150 pays) et peut être zéro-décimal — XAF, JPY : l'unité mineure y EST
 * l'unité. Le facteur se dérive d'`Intl` plutôt que d'une liste de devises
 * zéro-décimal écrite en dur, qui vieillirait sans que rien ne le signale.
 */
export const formatPresentmentAmount = (
  minorUnits: number,
  currency: string,
): string => {
  const code = currency.toUpperCase()
  try {
    const formatter = new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: code,
    })
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
    return formatter.format(minorUnits / 10 ** digits)
  } catch {
    // Intl lève un RangeError sur un code non conforme : mieux vaut un affichage
    // brut qu'un panneau admin qui plante sur une devise exotique.
    return `${minorUnits} ${code}`
  }
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

/** Durée restante : « 2h 5min », ou « 42 minutes » sous l'heure. */
export const formatDuration = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes} minutes`
}

/** « 27-09-2026_09-05 » — suffixe de nom de fichier d'export. */
export const formatFileTimestamp = (d: Date): string =>
  format(d, "dd-MM-yyyy_HH-mm")

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
