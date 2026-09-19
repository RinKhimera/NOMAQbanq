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
import { ownerReadableScore } from "../exams/dal.student"
import { defineOneShot, eligibleRecipient, sendOnce } from "./one-shot"

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
// désormais visibles. Marqueur posé pour tout éligible-par-date, envoi aux
// seuls opt-in (`shouldSend`) → pas de re-scan des lignes opt-out.
//
// ⚠️ Concurrence : `close-expired` est frappé par DEUX schedulers (GitHub Actions
// toutes les 3 h + Vercel quotidien) qui se recouvrent à minuit UTC ; c'est le
// claim de `sendOnce` qui garantit l'envoi unique.
export function sendExamResultsNotifications(): Promise<number> {
  return sendOnce({
    label: "résultats",
    tag: "[notif:resultats]",
    limit: EXAM_RESULTS_LIMIT,
    select: ({ now, limit }) =>
      db
        .select({
          id: examParticipations.id,
          userId: examParticipations.userId,
          examId: examParticipations.examId,
          // Retenu pour son propriétaire tant qu'une réponse chevauche un examen
          // ouvert : le courriel imprimerait sinon l'oracle de la page de résultats.
          score: ownerReadableScore,
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
            eligibleRecipient,
          ),
        )
        .limit(limit),
    claim: {
      table: examParticipations,
      idColumn: examParticipations.id,
      markerColumn: examParticipations.resultsNotifiedAt,
    },
    shouldSend: (r) => r.notify,
    send: (r) =>
      sendExamResultsEmail({
        to: r.email,
        name: r.name,
        examTitle: r.examTitle,
        score: r.score,
        resultUrl: `${getBaseUrl()}/tableau-de-bord/examen-blanc/${r.examId}/resultats`,
      }),
    context: (r) => ({ detail: `participation ${r.id}` }),
  })
}

// Rappel de fin d'accès : accès expirant dans ≤ 7 j, une seule fois. Marqueur
// `expiryReminderSentAt` (réinitialisé au renouvellement — Stripe + manuel).
// La garde du claim exige que `expiresAt` vaille encore la valeur lue : un
// renouvellement (`applyGrant`) qui prolonge l'accès entre la lecture et le
// claim ré-arme le marqueur, et un claim sur `IS NULL` seul passerait alors —
// courriel avec l'ancienne échéance, et plus aucun rappel pour la nouvelle.
// Refus = le prochain run relit l'échéance à jour.
export const accessExpiryReminderSpec = () =>
  defineOneShot({
    label: "accès",
    tag: "[notif:acces]",
    limit: ACCESS_REMINDER_LIMIT,
    select: ({ now, limit }) =>
      db
        .select({
          id: userAccess.id,
          userId: userAccess.userId,
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
            lt(userAccess.expiresAt, new Date(now.getTime() + 7 * DAY_MS)),
            isNull(userAccess.expiryReminderSentAt),
            eligibleRecipient,
          ),
        )
        .limit(limit),
    claim: {
      table: userAccess,
      idColumn: userAccess.id,
      markerColumn: userAccess.expiryReminderSentAt,
      guard: (r) => eq(userAccess.expiresAt, r.expiresAt),
    },
    shouldSend: (r) => r.notify,
    send: (r, { now }) =>
      sendAccessExpiringEmail({
        to: r.email,
        name: r.name,
        accessType: r.accessType,
        daysRemaining: Math.ceil(
          (r.expiresAt.getTime() - now.getTime()) / DAY_MS,
        ),
        renewUrl: `${getBaseUrl()}/tableau-de-bord/abonnements`,
      }),
    context: (r) => ({ detail: `accès ${r.id}` }),
  })

export function sendAccessExpiryReminders(): Promise<number> {
  return sendOnce(accessExpiryReminderSpec())
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
