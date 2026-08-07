import { TZDate } from "@date-fns/tz"

/**
 * Arithmétique du fuseau de la plateforme, séparée du formatage humain de
 * `lib/format.ts`. La frontière n'est pas cosmétique : les formateurs tirent
 * `date-fns` et sa locale française, un graphe de modules que les DAL n'ont
 * aucune raison de charger pour calculer une borne de requête. Importer
 * `lib/format` depuis `features/**` coûtait ~60 s d'import sur la suite de
 * tests. Ce module-ci ne dépend que de `@date-fns/tz`, qui n'a lui-même aucune
 * dépendance.
 */

/**
 * Fuseau de référence de la plateforme (Québec). `format()` de date-fns rend
 * dans le fuseau du runtime : serveur en UTC (TZ=UTC en prod/CI) vs navigateur
 * en heure locale → la même date sort différente au SSR et à l'hydratation
 * (mismatch React, arbre régénéré). Ancrer le fuseau rend la chaîne stable des
 * deux côtés, et une échéance d'examen désigne le même instant pour tous.
 */
export const APP_TIME_ZONE = "America/Toronto"

/**
 * Une chaîne date-only (`"2026-07-03"`) est parsée en minuit **UTC** par
 * `new Date()`, donc rendue la veille en heure de l'Est. Ne passer ici que des
 * instants réels (timestamp, `Date`, ISO complet).
 */
export const inAppZone = (d: Date | number | string) =>
  new TZDate(new Date(d), APP_TIME_ZONE)

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
 * Journée civile `YYYY-MM-DD` — format de transport des filtres de date. Un
 * instant ne désigne pas un jour : minuit local à Paris tombe la veille à
 * Toronto, donc une borne dérivée d'un instant se décale d'un jour selon le
 * fuseau du navigateur qui l'a produite.
 */
const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

const parseCalendarDay = (day: string): [number, number, number] => {
  const parts = CALENDAR_DAY.exec(day)
  const civil = parts
    ? new Date(
        Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])),
      )
    : null
  // Le motif ne borne ni le mois ni le quantième : sans cet aller-retour,
  // « 2026-13-45 » deviendrait le 14 février 2027 par débordement et la requête
  // porterait, en silence, sur une autre date que celle demandée.
  if (!civil || civil.toISOString().slice(0, 10) !== day)
    throw new Error(`Journée civile attendue (YYYY-MM-DD) : ${day}`)
  return [civil.getUTCFullYear(), civil.getUTCMonth(), civil.getUTCDate()]
}

const appZoneDayStart = (y: number, m: number, d: number): Date =>
  // `TZDate` ne sert qu'à résoudre le décalage du jour visé (heure d'été
  // comprise) ; on rend une `Date` simple, seul type que manipulent les couches
  // d'appel (Drizzle, comparaisons).
  new Date(new TZDate(y, m, d, 0, 0, 0, 0, APP_TIME_ZONE).getTime())

/** Premier instant d'une journée civile dans le fuseau de la plateforme. */
export const startOfAppZoneDay = (day: string): Date =>
  appZoneDayStart(...parseCalendarDay(day))

/**
 * Premier instant du LENDEMAIN — borne haute **exclusive** d'une journée
 * civile. Une borne inclusive à 23:59:59.999 laisserait échapper les lignes des
 * microsecondes suivantes : le `timestamptz` de Postgres est plus fin que le
 * millième de seconde de JavaScript.
 */
export const startOfNextAppZoneDay = (day: string): Date => {
  const [y, m, d] = parseCalendarDay(day)
  return appZoneDayStart(y, m, d + 1)
}

/**
 * Premier instant du mois civil contenant `d`, dans le fuseau de la plateforme.
 * `monthOffset` recule (négatif) ou avance de N mois.
 */
export const startOfAppZoneMonth = (
  d: Date | number | string,
  monthOffset = 0,
): Date => {
  const zoned = inAppZone(d)
  return appZoneDayStart(zoned.getFullYear(), zoned.getMonth() + monthOffset, 1)
}

/**
 * Journée civile d'un instant, dans le fuseau de la plateforme. Composée à la
 * main plutôt que via `format()` : ce module reste hors du graphe de date-fns.
 */
export const toAppZoneCalendarDay = (d: Date | number | string): string => {
  const zoned = inAppZone(d)
  const mois = String(zoned.getMonth() + 1).padStart(2, "0")
  const jour = String(zoned.getDate()).padStart(2, "0")
  return `${zoned.getFullYear()}-${mois}-${jour}`
}

/**
 * Décale une journée civile de `delta` jours. Le calcul se fait en UTC, où
 * toutes les journées durent 24 h : décaler des instants ferait sauter — ou
 * répéter — un jour aux changements d'heure.
 */
export const shiftCalendarDay = (day: string, delta: number): string => {
  const [y, m, d] = parseCalendarDay(day)
  return new Date(Date.UTC(y, m, d + delta)).toISOString().slice(0, 10)
}
