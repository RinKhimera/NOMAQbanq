import {
  and,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lt,
  notExists,
  or,
  sql,
} from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import {
  examParticipations,
  exams,
  session,
  trainingSessions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  sendAccessExpiringEmail,
  sendExamResultsEmail,
  sendInactivityReminderEmail,
} from "@/email"
import { getBaseUrl } from "@/lib/base-url"
import { captureServerError } from "@/lib/observability"

const DAY_MS = 24 * 60 * 60 * 1000
const EXAM_RESULTS_LIMIT = 500
const ACCESS_REMINDER_LIMIT = 200
const INACTIVITY_DAYS = 21
// Consentement tacite LCAP : 6 mois après une demande (inscription) ou un achat.
const CONSENT_WINDOW_DAYS = 183
// Borne par EXÉCUTION (pas par cadence) : un appel du cron GitHub Actions est
// limité dans le temps, un arriéré vidé d'un coup le dépasserait et
// déclencherait des retries. À 8 appels/jour, débit maximal 400 relances/jour —
// un ordre de grandeur au-dessus du besoin.
const INACTIVITY_LIMIT = 50

export type NotificationSweepResult = {
  examResultsSent: number
  accessRemindersSent: number
  inactivityRemindersSent: number
}

// Notifie les participants d'examens CLOS (endDate passée) dont les résultats sont
// désormais visibles. Marqueur `resultsNotifiedAt` = envoi unique. On pose le
// marqueur pour tout éligible-par-date (envoi seulement aux opt-in) → pas de
// re-scan des lignes opt-out. Comptes supprimés et suspendus exclus, marqueur
// non posé (le courriel repart si la suspension est levée). Borné + résilient
// (par ligne).
//
// ⚠️ Concurrence : `close-expired` est frappé par DEUX schedulers (GitHub Actions
// toutes les 3 h + Vercel quotidien) qui se recouvrent à minuit UTC. Deux runs lisent le
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
      name: user.name,
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
        eq(user.banned, false),
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
        name: r.name,
        examTitle: r.examTitle,
        score: r.score,
        resultUrl: `${getBaseUrl()}/tableau-de-bord/examen-blanc/${r.examId}/resultats`,
      })
      sent++
    } catch (error) {
      // Best-effort : si l'envoi échoue, le marqueur reste posé (anti-double), pas
      // de réessai — les résultats restent visibles en app. Perte tolérée d'un
      // email.
      captureServerError("[notif:resultats]", error, {
        detail: `participation ${r.participationId}`,
      })
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
      name: user.name,
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
        eq(user.banned, false),
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
        name: r.name,
        accessType: r.accessType,
        daysRemaining: Math.ceil(
          (r.expiresAt.getTime() - now.getTime()) / DAY_MS,
        ),
        renewUrl: `${getBaseUrl()}/tableau-de-bord/abonnements`,
      })
      sent++
    } catch (error) {
      captureServerError("[notif:acces]", error, {
        detail: `accès ${r.accessId}`,
      })
    }
  }
  return sent
}

// Relance d'inactivité : compte vérifié sans visite ni activité depuis 21 j,
// une seule fois par compte (marqueur jamais réinitialisé), dans la fenêtre de
// consentement. Quatre traces de visite : session vivante rafraîchie, connexion
// (la déconnexion supprime la session), entraînement lancé, examen lancé.
export async function sendInactivityReminders(): Promise<number> {
  const now = new Date()
  const inactiveSince = new Date(now.getTime() - INACTIVITY_DAYS * DAY_MS)
  const consentSince = new Date(now.getTime() - CONSENT_WINDOW_DAYS * DAY_MS)
  const one = sql`1`
  const rows = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(
      and(
        eq(user.role, "user"),
        eq(user.banned, false),
        isNull(user.deletedAt),
        eq(user.emailVerified, true),
        eq(user.notifyMarketing, true),
        isNull(user.inactivityReminderSentAt),
        lt(user.createdAt, inactiveSince),
        or(isNull(user.lastLoginAt), lt(user.lastLoginAt, inactiveSince)),
        notExists(
          db
            .select({ one })
            .from(session)
            .where(
              and(
                eq(session.userId, user.id),
                gt(session.updatedAt, inactiveSince),
              ),
            ),
        ),
        notExists(
          db
            .select({ one })
            .from(trainingSessions)
            .where(
              and(
                eq(trainingSessions.userId, user.id),
                gt(trainingSessions.startedAt, inactiveSince),
              ),
            ),
        ),
        notExists(
          db
            .select({ one })
            .from(examParticipations)
            .where(
              and(
                eq(examParticipations.userId, user.id),
                gt(examParticipations.startedAt, inactiveSince),
              ),
            ),
        ),
        or(
          gt(user.createdAt, consentSince),
          exists(
            db
              .select({ one })
              .from(transactions)
              .where(
                and(
                  eq(transactions.userId, user.id),
                  eq(transactions.status, "completed"),
                  gt(transactions.completedAt, consentSince),
                ),
              ),
          ),
        ),
      ),
    )
    .limit(INACTIVITY_LIMIT)

  if (rows.length === INACTIVITY_LIMIT) {
    console.warn(
      `[notif] inactivité — borne ${INACTIVITY_LIMIT} atteinte : le reste sera traité au prochain run`,
    )
  }

  let sent = 0
  for (const r of rows) {
    try {
      const claimed = await db
        .update(user)
        .set({ inactivityReminderSentAt: now })
        .where(and(eq(user.id, r.id), isNull(user.inactivityReminderSentAt)))
        .returning({ id: user.id })
      if (claimed.length === 0) continue
      await sendInactivityReminderEmail({
        to: r.email,
        name: r.name,
        userId: r.id,
      })
      sent++
    } catch (error) {
      captureServerError("[notif:inactivite]", error, { userId: r.id })
    }
  }
  return sent
}

export async function sendPendingNotifications(): Promise<NotificationSweepResult> {
  const examResultsSent = await sendExamResultsNotifications()
  const accessRemindersSent = await sendAccessExpiryReminders()
  const inactivityRemindersSent = await sendInactivityReminders()
  return { examResultsSent, accessRemindersSent, inactivityRemindersSent }
}
