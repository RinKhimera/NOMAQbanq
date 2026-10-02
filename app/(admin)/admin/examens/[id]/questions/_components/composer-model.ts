import { countLabel } from "@/components/admin/question-detail/labels"
import { MEDICAL_DOMAINS } from "@/constants"
import type {
  BankQuestion,
  DomainPlanRow,
  LastUse,
} from "@/features/questions/dal"
import { calendarDaysUntil } from "@/lib/exam-readiness"
import { EXAM_STATUS_CONFIG, type ExamStatus } from "@/lib/exam-status"

// Module pur : libellés et regroupements du compositeur, `now` en paramètre.

/** « il y a 2 sem. », « dans 9 j » (examen finalisé à venir), en journées de l'Est. */
export const lastUseAgo = (startDate: number, now: number): string => {
  const days = calendarDaysUntil(startDate, now)
  if (days > 0) return `dans ${days} j`
  if (days === 0) return "aujourd'hui"
  const past = -days
  if (past < 7) return `il y a ${past} j`
  if (past < 30) return `il y a ${Math.floor(past / 7)} sem.`
  if (past < 365) return `il y a ${Math.floor(past / 30)} mois`
  const years = Math.floor(past / 365)
  return `il y a ${years} an${years > 1 ? "s" : ""}`
}

/** « EB-25 · il y a 2 sem. » */
export const lastUseLabel = (use: LastUse, now: number) =>
  `${use.title} · ${lastUseAgo(use.startDate, now)}`

export const isRecent = (q: Pick<BankQuestion, "lastUse">) =>
  q.lastUse?.recent ?? false

export type CounterTone = "danger" | "success" | "accent"

export type Counter = {
  /** Questions qui manquent pour atteindre le visé. */
  need: number
  /** Questions en trop. */
  over: number
  tone: CounterTone
  message: string
}

export const counterOf = ({
  count,
  target,
  frozen,
}: {
  count: number
  target: number
  frozen: boolean
}): Counter => {
  const need = Math.max(0, target - count)
  const over = Math.max(0, count - target)
  const tone: CounterTone =
    over > 0 ? "danger" : need === 0 ? "success" : "accent"
  const message = frozen
    ? "Jeu de questions figé depuis la première participation."
    : over > 0
      ? `Retirez ${countLabel(over, "question")}.`
      : need === 0
        ? "Le jeu est complet : finalisez l'examen."
        : `Il reste ${countLabel(need, "question")} à choisir.`
  return { need, over, tone, message }
}

/** Sous-titre de la page : « EB-27 · en préparation ». */
export const composerLead = (
  title: string,
  phase: ExamStatus,
  frozen: boolean,
) => {
  if (frozen) return `${title} · jeu de questions figé`
  return `${title} · ${EXAM_STATUS_CONFIG[phase].label.toLocaleLowerCase("fr-CA")}`
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

/** Recherche locale de la sélection : énoncé, choix, objectif, identifiant. */
export const matchesQuery = (
  q: Pick<BankQuestion, "id" | "question" | "options" | "objectifCMC">,
  query: string,
) => {
  const needle = fold(query.trim())
  if (!needle) return true
  return (
    q.id === query.trim() ||
    [q.question, q.objectifCMC, ...q.options].some((t) =>
      fold(t).includes(needle),
    )
  )
}

const domainOrder = (domain: string) => {
  const i = (MEDICAL_DOMAINS as readonly string[]).indexOf(domain)
  return i === -1 ? MEDICAL_DOMAINS.length : i
}

const byDomain = (a: string, b: string) =>
  domainOrder(a) - domainOrder(b) || a.localeCompare(b, "fr")

/** Sélection groupée par domaine (ordre des domaines), groupes vides omis. */
export const groupSelection = <
  T extends Pick<
    BankQuestion,
    "id" | "question" | "options" | "objectifCMC" | "domain"
  >,
>(
  items: T[],
  query: string,
): { domain: string; rows: T[] }[] => {
  const groups = new Map<string, T[]>()
  for (const q of items) {
    if (!matchesQuery(q, query)) continue
    groups.set(q.domain, [...(groups.get(q.domain) ?? []), q])
  }
  return [...groups.keys()]
    .sort(byDomain)
    .map((domain) => ({ domain, rows: groups.get(domain) ?? [] }))
}

/** Alertes de la sélection. */
export const selectionAlerts = (
  items: Pick<BankQuestion, "lastUse" | "keyToVerify" | "deleted">[],
) => ({
  recent: items.filter(isRecent).length,
  toVerify: items.filter((q) => q.keyToVerify).length,
  deleted: items.filter((q) => q.deleted).length,
})

/**
 * Plan par domaine : les 22 domaines, un domaine absent de la lecture à 0,
 * puis un domaine hors liste s'il existe en base.
 */
export const fullDomainPlan = (rows: DomainPlanRow[]): DomainPlanRow[] => {
  const known = new Map(rows.map((r) => [r.domain, r]))
  const domains = [...new Set([...MEDICAL_DOMAINS, ...known.keys()])].sort(
    byDomain,
  )
  return domains.map(
    (domain) =>
      known.get(domain) ?? { domain, chosen: 0, available: 0, recent: 0 },
  )
}

/** « 21–40 sur 153 » */
export const rangeLabel = (page: number, pageSize: number, total: number) => {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const n = (v: number) => v.toLocaleString("fr-CA")
  return `${n(from)}–${n(to)} sur ${n(total)}`
}

/** « 12 questions ajoutées », « 1 question retirée ». */
export const changedLabel = (n: number, verb: "ajoutée" | "retirée") =>
  `${countLabel(n, "question")} ${verb}${n > 1 ? "s" : ""}`
