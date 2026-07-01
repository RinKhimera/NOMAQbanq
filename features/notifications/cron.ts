import { and, eq, gt, inArray, isNull, lt } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { examParticipations, exams, user, userAccess } from "@/db/schema"
import { sendAccessExpiringEmail, sendExamResultsEmail } from "@/email"
import { getBaseUrl } from "@/lib/base-url"

const DAY_MS = 24 * 60 * 60 * 1000
const EXAM_RESULTS_LIMIT = 500
const ACCESS_REMINDER_LIMIT = 200

export type NotificationSweepResult = {
  examResultsSent: number
  accessRemindersSent: number
}

// Notifie les participants d'examens CLOS (endDate passée) dont les résultats sont
// désormais visibles. Marqueur `resultsNotifiedAt` = envoi unique. On pose le
// marqueur pour tout éligible-par-date (envoi seulement aux opt-in) → pas de
// re-scan des lignes opt-out. Borné + résilient (par ligne).
//
// ⚠️ Concurrence : `close-expired` est frappé par DEUX schedulers (GitHub Actions
// horaire + Vercel quotidien) qui se recouvrent à minuit UTC. Deux runs lisent le
// même lot `IS NULL`. On CLAIM donc chaque ligne par un UPDATE gardé atomique
// (`SET marqueur=now WHERE marqueur IS NULL RETURNING`) AVANT l'envoi : seul le
// run qui gagne le claim envoie → jamais de double email (même idiome que la
// clôture d'examens, features/exams/cron.ts).
export async function sendExamResultsNotifications(): Promise<number> {
  const now = new Date()
  const rows = await db
    .select({
      participationId: examParticipations.id,
      examId: examParticipations.examId,
      score: examParticipations.score,
      email: user.email,
      notify: user.notifyExamResults,
      examTitle: exams.title,
    })
    .from(examParticipations)
    .innerJoin(exams, eq(exams.id, examParticipations.examId))
    .innerJoin(user, eq(user.id, examParticipations.userId))
    .where(
      and(
        lt(exams.endDate, now),
        inArray(examParticipations.status, ["completed", "auto_submitted"]),
        isNull(examParticipations.resultsNotifiedAt),
        isNull(user.deletedAt),
      ),
    )
    .limit(EXAM_RESULTS_LIMIT)

  if (rows.length === EXAM_RESULTS_LIMIT) {
    console.warn(
      `[notif] résultats — borne ${EXAM_RESULTS_LIMIT} atteinte : le reste sera traité au prochain run`,
    )
  }

  let sent = 0
  for (const r of rows) {
    try {
      // Claim atomique (anti double-envoi concurrent) : ne poursuit que si CE run
      // pose le marqueur ; un run concurrent obtient 0 ligne et saute.
      const claimed = await db
        .update(examParticipations)
        .set({ resultsNotifiedAt: now })
        .where(
          and(
            eq(examParticipations.id, r.participationId),
            isNull(examParticipations.resultsNotifiedAt),
          ),
        )
        .returning({ id: examParticipations.id })
      if (claimed.length === 0) continue // déjà pris par un autre run
      if (!r.notify) continue // opt-out : marqueur posé, pas d'envoi (spec §5)

      await sendExamResultsEmail({
        to: r.email,
        examTitle: r.examTitle,
        score: r.score,
        resultUrl: `${getBaseUrl()}/dashboard/examen-blanc/${r.examId}/resultats`,
      })
      sent++
    } catch (error) {
      // Best-effort : si l'envoi échoue, le marqueur reste posé (anti-double), pas
      // de réessai — les résultats restent visibles en app. Perte tolérée d'un
      // email (cf. spec §5 + Notes d'implémentation).
      console.error(
        `[notif] résultats — échec (participation ${r.participationId})`,
        error,
      )
    }
  }
  return sent
}

// Rappel de fin d'accès : accès expirant dans ≤ 7 j, une seule fois. Marqueur
// `expiryReminderSentAt` (réinitialisé au renouvellement — Stripe + manuel).
// Même claim atomique que ci-dessus (anti double-envoi concurrent).
export async function sendAccessExpiryReminders(): Promise<number> {
  const now = new Date()
  const in7d = new Date(now.getTime() + 7 * DAY_MS)
  const rows = await db
    .select({
      accessId: userAccess.id,
      accessType: userAccess.accessType,
      expiresAt: userAccess.expiresAt,
      email: user.email,
      notify: user.notifyAccessExpiry,
    })
    .from(userAccess)
    .innerJoin(user, eq(user.id, userAccess.userId))
    .where(
      and(
        gt(userAccess.expiresAt, now),
        lt(userAccess.expiresAt, in7d),
        isNull(userAccess.expiryReminderSentAt),
        isNull(user.deletedAt),
      ),
    )
    .limit(ACCESS_REMINDER_LIMIT)

  if (rows.length === ACCESS_REMINDER_LIMIT) {
    console.warn(
      `[notif] accès — borne ${ACCESS_REMINDER_LIMIT} atteinte : le reste sera traité au prochain run`,
    )
  }

  let sent = 0
  for (const r of rows) {
    try {
      const claimed = await db
        .update(userAccess)
        .set({ expiryReminderSentAt: now })
        .where(
          and(
            eq(userAccess.id, r.accessId),
            isNull(userAccess.expiryReminderSentAt),
          ),
        )
        .returning({ id: userAccess.id })
      if (claimed.length === 0) continue // déjà pris par un autre run
      if (!r.notify) continue // opt-out : marqueur posé, pas d'envoi

      await sendAccessExpiringEmail({
        to: r.email,
        accessType: r.accessType,
        daysRemaining: Math.ceil(
          (r.expiresAt.getTime() - now.getTime()) / DAY_MS,
        ),
        renewUrl: `${getBaseUrl()}/dashboard/abonnements`,
      })
      sent++
    } catch (error) {
      console.error(`[notif] accès — échec (accès ${r.accessId})`, error)
    }
  }
  return sent
}

export async function sendPendingNotifications(): Promise<NotificationSweepResult> {
  const examResultsSent = await sendExamResultsNotifications()
  const accessRemindersSent = await sendAccessExpiryReminders()
  return { examResultsSent, accessRemindersSent }
}
