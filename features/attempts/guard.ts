import { sql } from "drizzle-orm"
import "server-only"
import type { Db } from "@/db"
import { type AttemptTiming, isExpired } from "@/lib/attempt-clock"
import { isOpen } from "@/lib/exam-phase"
import { DEFAULT_PAUSE_MINUTES } from "../exams/schemas"
import { hasActiveAccess } from "../payments/dal"

/**
 * Garde d'écriture sur une tentative (`CONTEXT.md` : participation ou session
 * d'entraînement). Toute écriture prend un verrou de ligne sur la tentative,
 * dans la transaction de l'appelant, et la clôture par expiration n'appartient
 * qu'au cron : un refus n'écrit jamais (voir `docs/adr/0001`).
 *
 * La politique est une table, un verbe par ligne :
 *
 * | verbe   | fenêtre/TTL | accès | pause    | budget                    |
 * | ------- | ----------- | ----- | -------- | ------------------------- |
 * | answer  | ✓           | ✓     | interdit | appliqué                  |
 * | close   | ✓           | ✓     | crédité  | appliqué sauf auto-submit |
 * | flag    | –           | –     | permis   | –                         |
 * | pause   | –           | –     | (local)  | –                         |
 * | resume  | –           | –     | (local)  | –                         |
 * | abandon | –           | –     | permis   | –                         |
 *
 * Un admin n'est soumis ni à l'accès payant ni au budget : sa participation
 * n'est pas une tentative notée. `isAutoSubmit` est déclaré par le client : il
 * n'exempte que la clôture, jamais une réponse — c'est la garde `answer` qui
 * tient le budget.
 */
export type Executor = Pick<Db, "execute" | "select">

export type AttemptKind = "training" | "exam"

export type AttemptVerb =
  "answer" | "close" | "flag" | "pause" | "resume" | "abandon"

export type RefusalCode =
  | "NOT_FOUND"
  | "NOT_IN_PROGRESS"
  | "NOT_STARTED"
  | "EXPIRED"
  | "OUTSIDE_WINDOW"
  | "ACCESS_EXPIRED"
  | "PAUSED"
  | "TIME_UP"

export type Actor = { id: string; role: "user" | "admin" }

export type TrainingAttempt = {
  kind: "training"
  id: string
  mode: "test" | "tutor"
  questionCount: number
  expiresAt: number
}

export type ExamAttempt = {
  kind: "exam"
  /** Identifiant de la participation. */
  id: string
  timing: AttemptTiming
  exam: {
    enablePause: boolean
    pauseDurationMinutes: number | null
    audienceType: "subscribers" | "restricted"
  }
}

export type Attempt = TrainingAttempt | ExamAttempt

export type Refusal = { ok: false; code: RefusalCode }
export type Outcome<A extends Attempt> = { ok: true; attempt: A } | Refusal

type Common = { actor: Actor; now: number; verb: AttemptVerb }
export type RequireAttemptArgs =
  | ({ kind: "training"; ref: string } & Common)
  | ({ kind: "exam"; ref: string; isAutoSubmit?: boolean } & Common)

const GUARDED_VERBS: ReadonlySet<AttemptVerb> = new Set(["answer", "close"])

type TrainingRow = {
  id: string
  status: string
  mode: "test" | "tutor"
  question_count: number
  expires_at: Date
}

type ExamRow = {
  id: string
  status: string
  started_at: Date | null
  pause_started_at: Date | null
  /** bigint : le driver pg rend une chaîne. */
  total_pause_duration_ms: string | number | null
  start_date: Date
  end_date: Date
  completion_time: number
  pause_duration_minutes: number | null
  enable_pause: boolean
  audience_type: "subscribers" | "restricted"
}

const requireTraining = async (
  exec: Executor,
  { ref, actor, now, verb }: { ref: string } & Common,
): Promise<Outcome<TrainingAttempt>> => {
  const res = await exec.execute(sql`
    select id, status, mode, question_count, expires_at
      from training_sessions
     where id = ${ref} and user_id = ${actor.id}
       for update
  `)
  const row = res.rows[0] as TrainingRow | undefined
  if (!row) return { ok: false, code: "NOT_FOUND" }
  if (row.status !== "in_progress") {
    return { ok: false, code: "NOT_IN_PROGRESS" }
  }

  const expiresAt = row.expires_at.getTime()
  if (GUARDED_VERBS.has(verb)) {
    // Même borne que le cron de clôture (`expires_at < now`).
    if (expiresAt < now) return { ok: false, code: "EXPIRED" }
    if (
      actor.role !== "admin" &&
      !(await hasActiveAccess(exec, {
        userId: actor.id,
        type: "training",
        now,
      }))
    ) {
      return { ok: false, code: "ACCESS_EXPIRED" }
    }
  }

  return {
    ok: true,
    attempt: {
      kind: "training",
      id: row.id,
      mode: row.mode,
      questionCount: row.question_count,
      expiresAt,
    },
  }
}

const requireExam = async (
  exec: Executor,
  {
    ref,
    actor,
    now,
    verb,
    isAutoSubmit,
  }: { ref: string; isAutoSubmit?: boolean } & Common,
): Promise<Outcome<ExamAttempt>> => {
  // `for update of p` : la ligne `exams` reste libre, sinon chaque réponse de
  // chaque candidat se mettrait en file derrière les autres.
  const res = await exec.execute(sql`
    select p.id, p.status, p.started_at, p.pause_started_at,
           p.total_pause_duration_ms,
           e.start_date, e.end_date, e.completion_time,
           e.pause_duration_minutes, e.enable_pause, e.audience_type
      from exam_participations p
      join exams e on e.id = p.exam_id
     where p.exam_id = ${ref} and p.user_id = ${actor.id}
       for update of p
  `)
  const row = res.rows[0] as ExamRow | undefined
  if (!row) return { ok: false, code: "NOT_FOUND" }
  if (row.status !== "in_progress") {
    return { ok: false, code: "NOT_IN_PROGRESS" }
  }
  if (!row.started_at) return { ok: false, code: "NOT_STARTED" }

  const timing: AttemptTiming = {
    startedAt: row.started_at.getTime(),
    budgetSeconds: row.completion_time,
    pauseCreditMs: Number(row.total_pause_duration_ms ?? 0),
    pauseInProgress: row.pause_started_at
      ? {
          startedAt: row.pause_started_at.getTime(),
          capMinutes: row.pause_duration_minutes ?? DEFAULT_PAUSE_MINUTES,
        }
      : null,
  }

  if (GUARDED_VERBS.has(verb)) {
    const window = {
      startDate: row.start_date.getTime(),
      endDate: row.end_date.getTime(),
    }
    if (now < window.startDate || !isOpen(window, now)) {
      return { ok: false, code: "OUTSIDE_WINDOW" }
    }
    // Audience restreinte : la participation vaut autorisation.
    if (
      actor.role !== "admin" &&
      row.audience_type === "subscribers" &&
      !(await hasActiveAccess(exec, { userId: actor.id, type: "exam", now }))
    ) {
      return { ok: false, code: "ACCESS_EXPIRED" }
    }
    if (verb === "answer" && timing.pauseInProgress) {
      return { ok: false, code: "PAUSED" }
    }
    const budgetApplies =
      actor.role !== "admin" && !(verb === "close" && isAutoSubmit)
    if (budgetApplies && isExpired(timing, now)) {
      return { ok: false, code: "TIME_UP" }
    }
  }

  return {
    ok: true,
    attempt: {
      kind: "exam",
      id: row.id,
      timing,
      exam: {
        enablePause: row.enable_pause,
        pauseDurationMinutes: row.pause_duration_minutes,
        audienceType: row.audience_type,
      },
    },
  }
}

export function requireAttempt(
  exec: Executor,
  args: { kind: "training"; ref: string } & Common,
): Promise<Outcome<TrainingAttempt>>
export function requireAttempt(
  exec: Executor,
  args: { kind: "exam"; ref: string; isAutoSubmit?: boolean } & Common,
): Promise<Outcome<ExamAttempt>>
/**
 * Verrouille la tentative de l'acteur et applique la politique du verbe. La
 * propriété est dans le WHERE : une tentative d'autrui est introuvable.
 * `ref` : identifiant de la session d'entraînement, ou de l'EXAMEN (la
 * participation est unique par (examen, acteur)).
 */
export function requireAttempt(
  exec: Executor,
  args: RequireAttemptArgs,
): Promise<Outcome<Attempt>> {
  return args.kind === "training"
    ? requireTraining(exec, args)
    : requireExam(exec, args)
}

const MESSAGES: Record<RefusalCode, Record<AttemptKind, string>> = {
  NOT_FOUND: {
    training: "Session introuvable",
    exam: "Participation introuvable.",
  },
  NOT_IN_PROGRESS: {
    training: "Cette session n'est plus active",
    exam: "Cette session d'examen n'est plus active.",
  },
  NOT_STARTED: {
    training: "Cette session n'a pas encore été démarrée",
    exam: "L'examen n'a pas encore été démarré.",
  },
  EXPIRED: {
    training: "Cette session a expiré",
    exam: "Cette session d'examen a expiré.",
  },
  OUTSIDE_WINDOW: {
    training: "Cette session n'est pas disponible à cette période",
    exam: "L'examen n'est pas disponible à cette période.",
  },
  ACCESS_EXPIRED: {
    training: "Votre accès à l'entraînement a expiré.",
    exam: "Votre accès aux examens a expiré.",
  },
  PAUSED: {
    training: "Réponse impossible pendant la pause",
    exam: "Réponse impossible pendant la pause.",
  },
  TIME_UP: {
    training: "Temps écoulé.",
    exam: "Temps écoulé.",
  },
}

export const refusalMessage = (code: RefusalCode, kind: AttemptKind): string =>
  MESSAGES[code][kind]
