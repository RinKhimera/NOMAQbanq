import type { ExamField, ExamFieldErrors } from "@/features/exams/actions"
import type {
  AdminExam,
  ExamAudienceUser,
  ExamReopeningSource,
} from "@/features/exams/dal"
import {
  DEFAULT_PAUSE_MINUTES,
  MAX_EXAM_QUESTIONS,
  MIN_EXAM_QUESTIONS,
  SECONDS_PER_QUESTION,
  type SaveExamInput,
} from "@/features/exams/schemas"
import type { BankQuestion } from "@/features/questions/dal"
import { NBSP, formatIsoDay } from "@/lib/format"

/** État entier du formulaire : `saveExam` le reçoit toujours en entier. */
export type ExamFormValues = {
  title: string
  description: string
  /** Minuit du navigateur le jour choisi, en epoch ms. */
  startDate: number | null
  endDate: number | null
  /** 0 tant que le champ est vide. */
  targetQuestionCount: number
  enablePause: boolean
  pauseDurationMinutes: number
  audienceType: "subscribers" | "restricted"
  audience: ExamAudienceUser[]
}

/** Examen déjà enregistré que le formulaire modifie. */
export type SavedExam = {
  id: string
  title: string
  startDate: number | null
  endDate: number | null
  finalizedAt: number | null
  isActive: boolean
  targetQuestionCount: number
  /** Taille du jeu enregistré. */
  questionCount: number
  /** Participations de tous les comptes, admin compris. */
  participations: number
  /** Jeu figé : au moins une participation, de n'importe quel compte. */
  locked: boolean
}

export const STEP_ID = {
  informations: "informations",
  window: "fenetre",
  format: "format",
  audience: "audience",
  questions: "questions",
} as const

export type StepKey = keyof typeof STEP_ID

const STEP_OF_FIELD: Record<ExamField, StepKey> = {
  title: "informations",
  startDate: "window",
  endDate: "window",
  targetQuestionCount: "format",
  audienceUserIds: "audience",
  questionIds: "questions",
}

const STEP_ORDER: StepKey[] = [
  "informations",
  "window",
  "format",
  "audience",
  "questions",
]

/** Première étape (dans l'ordre de la page) qui porte une erreur. */
export const firstFailingStep = (errors: ExamFieldErrors): StepKey | null => {
  const failing = new Set(
    (Object.keys(errors) as ExamField[])
      .filter((f) => errors[f])
      .map((f) => STEP_OF_FIELD[f]),
  )
  return STEP_ORDER.find((s) => failing.has(s)) ?? null
}

const REOPENING_SUFFIX = " (réouverture)"

/** Titre d'une réouverture ; rouvrir une réouverture ne répète pas le suffixe. */
export const reopeningTitle = (title: string) =>
  (title.endsWith(REOPENING_SUFFIX)
    ? title.slice(0, -REOPENING_SUFFIX.length)
    : title) + REOPENING_SUFFIX

export const blankExamForm = (): ExamFormValues => ({
  title: "",
  description: "",
  startDate: null,
  endDate: null,
  targetQuestionCount: MAX_EXAM_QUESTIONS,
  enablePause: false,
  pauseDurationMinutes: DEFAULT_PAUSE_MINUTES,
  audienceType: "subscribers",
  audience: [],
})

export const examFormFromExam = (
  exam: AdminExam["exam"],
  audience: ExamAudienceUser[],
): ExamFormValues => ({
  title: exam.title,
  description: exam.description ?? "",
  startDate: exam.startDate,
  endDate: exam.endDate,
  targetQuestionCount: exam.targetQuestionCount,
  enablePause: exam.enablePause,
  pauseDurationMinutes: exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES,
  audienceType: exam.audienceType,
  audience: exam.audienceType === "restricted" ? audience : [],
})

/** Réouverture : tout sauf les dates, qui restent à choisir. Le visé est celui de la source. */
export const examFormFromSource = (
  source: ExamReopeningSource,
): ExamFormValues => ({
  title: reopeningTitle(source.exam.title),
  description: source.exam.description ?? "",
  startDate: null,
  endDate: null,
  targetQuestionCount: source.exam.questionCount,
  enablePause: source.exam.enablePause,
  pauseDurationMinutes:
    source.exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES,
  audienceType: source.exam.audienceType,
  audience: source.audience,
})

export const isTargetValid = (n: number) =>
  Number.isInteger(n) && n >= MIN_EXAM_QUESTIONS && n <= MAX_EXAM_QUESTIONS

export const TARGET_ERROR = `Entre ${MIN_EXAM_QUESTIONS} et ${MAX_EXAM_QUESTIONS}.`
export const TITLE_ERROR = "Donnez un titre à l'examen."

/** Ce que « Enregistrer » exige : un titre et un visé dans les bornes. */
export const saveErrors = (v: ExamFormValues): ExamFieldErrors => ({
  ...(v.title.trim() ? {} : { title: TITLE_ERROR }),
  ...(isTargetValid(v.targetQuestionCount)
    ? {}
    : { targetQuestionCount: TARGET_ERROR }),
})

export const datesOutOfOrder = (v: ExamFormValues) =>
  v.startDate !== null && v.endDate !== null && v.endDate <= v.startDate

/**
 * Charge de `saveExam` : l'état entier, dates nulles comprises. `questionIds`
 * ne part que pour créer une réouverture ; absent, le jeu est conservé.
 */
export const toSavePayload = (
  v: ExamFormValues,
  opts: { id?: string; questionIds?: string[] },
): SaveExamInput => ({
  ...(opts.id && { id: opts.id }),
  title: v.title.trim(),
  description: v.description.trim(),
  targetQuestionCount: v.targetQuestionCount,
  startDate: v.startDate,
  endDate: v.endDate,
  ...(opts.questionIds && { questionIds: opts.questionIds }),
  enablePause: v.enablePause,
  pauseDurationMinutes: v.enablePause ? v.pauseDurationMinutes : undefined,
  audienceType: v.audienceType,
  audienceUserIds:
    v.audienceType === "restricted" ? v.audience.map((u) => u.id) : [],
})

/**
 * Le visé saisi remet un examen finalisé en préparation : il diffère du visé
 * enregistré ET de la taille du jeu (`saveExam` ne compte pas un visé ramené
 * au jeu comme un changement).
 */
export const targetResetsFinalization = (
  saved: SavedExam | null,
  target: number,
) =>
  saved !== null &&
  saved.finalizedAt !== null &&
  !saved.locked &&
  isTargetValid(target) &&
  target !== saved.targetQuestionCount &&
  target !== saved.questionCount

/** « 3 h 11 » : durée d'un examen de `n` questions. */
export const examDuration = (n: number) => {
  const minutes = Math.round((n * SECONDS_PER_QUESTION) / 60)
  return `${Math.floor(minutes / 60)}${NBSP}h${NBSP}${String(minutes % 60).padStart(2, "0")}`
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Jour du calendrier (`yyyy-MM-dd`) d'un instant, lu dans le fuseau du navigateur. */
export const toLocalDay = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Minuit du navigateur le jour choisi ; `null` pour un champ vidé. */
export const fromLocalDay = (day: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
}

const dayIndex = (day: string) => {
  const [y, m, d] = day.split("-").map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

const shortDay = (day: string) => formatIsoDay(day).replace(/^1 /, "1er ")

/** « Ouvert 3 jours : du 6 nov. 0 h 00 au 9 nov. 0 h 00 » (fin exclusive). */
export const windowNote = (startDay: string, endDay: string) => {
  const n = dayIndex(endDay) - dayIndex(startDay)
  const midnight = `0${NBSP}h${NBSP}00`
  return `Ouvert ${n} jour${n > 1 ? "s" : ""}${NBSP}: du ${shortDay(startDay)} ${midnight} au ${shortDay(endDay)} ${midnight}`
}

export type SelectionSummary = {
  count: number
  /** Cinq domaines les plus représentés, du plus au moins fourni. */
  topDomains: [domain: string, count: number][]
  recent: number
  keyToVerify: number
}

export const selectionSummary = (
  selection: BankQuestion[],
): SelectionSummary => {
  const byDomain = new Map<string, number>()
  for (const q of selection) {
    byDomain.set(q.domain, (byDomain.get(q.domain) ?? 0) + 1)
  }
  return {
    count: selection.length,
    topDomains: [...byDomain.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
      .slice(0, 5),
    recent: selection.filter((q) => q.lastUse?.recent).length,
    keyToVerify: selection.filter((q) => q.keyToVerify).length,
  }
}
