// Filtres `beforeSend` de Vercel Web Analytics et Speed Insights. Module pur,
// sans "use client" : le composant client qui monte les deux outils l'importe.
import { TRAINING_HREF } from "@/constants"
import { STUDENT_EXAMS_HREF } from "@/constants/exam-routes"
import { ADMIN_HREF } from "@/lib/admin-links"

type InsightsEvent = { url: string }

// Toute chaîne de requête part, sans liste blanche : jetons de
// réinitialisation et de désabonnement, session Stripe au retour de paiement.
// Une liste blanche laisserait passer le jeton d'une future page.
const withoutQuery = (url: string) => url.replace(/[?#].*$/, "")

const pathOf = (url: string) =>
  new URL(url, "https://placeholder.invalid").pathname

// Par segment : `/admin` et `/admin/...`, jamais `/administration-...`.
const isUnder = (path: string, root: string) =>
  path === root || path.startsWith(`${root}/`)

const scrubOrDrop = <E extends InsightsEvent>(
  event: E,
  excluded: (path: string) => boolean,
) => {
  const url = withoutQuery(event.url)
  return excluded(pathOf(url)) ? null : { ...event, url }
}

const isAdmin = (path: string) => isUnder(path, ADMIN_HREF)

// Les deux pages du groupe `(passation)` : une série en cours
// (`/entrainement/[id]`, pas ses `/resultats`) et l'évaluation d'un examen
// blanc (`/examen-blanc/[id]/evaluation`).
const segmentsAfter = (path: string, root: string) =>
  isUnder(path, root) ? path.slice(root.length).split("/").filter(Boolean) : []

const isPassation = (path: string) => {
  const series = segmentsAfter(path, TRAINING_HREF)
  const exam = segmentsAfter(path, STUDENT_EXAMS_HREF)
  return series.length === 1 || (exam.length === 2 && exam[1] === "evaluation")
}

// Une page vue de passation n'apprend rien sur l'audience ; sa vitesse, si.
export const analyticsBeforeSend = <E extends InsightsEvent>(event: E) =>
  scrubOrDrop(event, (path) => isAdmin(path) || isPassation(path))

export const speedInsightsBeforeSend = <E extends InsightsEvent>(event: E) =>
  scrubOrDrop(event, isAdmin)
