import { and, desc, eq, gt, ilike, inArray, lte, notExists } from "drizzle-orm"
import { db } from "@/db"
import {
  examAnswers,
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  products,
  questions,
  trainingSessionItems,
  trainingSessions,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import { env } from "@/lib/env/server"
import { createId } from "@/lib/ids"

// Accès DB → runtime Node.
export const runtime = "nodejs"

/**
 * Support des tests E2E (reset/cleanup des données de test sur Neon develop).
 * Remplace les routes Convex HTTP `/e2e/reset-exam` + `/e2e/cleanup` (supprimées
 * avec `convex/`). UNE route, deux actions dans le corps :
 *  - `{ action: "reset-exam", userEmail }` : réactive un examen en fenêtre +
 *    supprime la participation du user sur cet examen (cascade réponses) +
 *    ses sessions d'entraînement `in_progress` (cascade items) → passation
 *    rejouable.
 *  - `{ action: "cleanup", prefix }` : supprime les examens préfixés (cascade)
 *    et les questions préfixées NON référencées (FK restrict respectée).
 *  - `{ action: "set-access", userEmail, accessType, grant }` : octroie (grant
 *    true, défaut) ou révoque (false) un accès `exam`/`training`. Idempotent ;
 *    l'octroi crée une transaction manuelle `[E2E]` si nécessaire (FK NOT NULL).
 *
 * Sécurité : fail-closed. La route répond 404 si `E2E_RESET_SECRET` absente OU
 * si on tourne sur la prod Vercel (`VERCEL_ENV === "production"`) — impossible à
 * déclencher en prod même si le secret fuitait. Le secret est exigé dans le corps.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const isDisabled = () =>
  !env.E2E_RESET_SECRET || process.env.VERCEL_ENV === "production"

async function resetExam(userEmail: string) {
  const [u] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, userEmail))
    .limit(1)
  if (!u) {
    return { userFound: false as const }
  }

  const now = new Date()

  // Garantit UN examen actif en fenêtre (les POM ciblent « l'examen actif »).
  const [inWindow] = await db
    .select({ id: exams.id })
    .from(exams)
    .where(
      and(
        eq(exams.isActive, true),
        lte(exams.startDate, now),
        gt(exams.endDate, now),
      ),
    )
    .limit(1)

  let activeExamId = inWindow?.id ?? null
  if (!activeExamId) {
    // Aucun en fenêtre → étend la fenêtre de l'examen actif le plus récent.
    const [latest] = await db
      .select({ id: exams.id })
      .from(exams)
      .where(eq(exams.isActive, true))
      .orderBy(desc(exams.createdAt))
      .limit(1)
    if (latest) {
      await db
        .update(exams)
        .set({
          startDate: new Date(now.getTime() - 60_000),
          endDate: new Date(now.getTime() + 30 * DAY_MS),
        })
        .where(eq(exams.id, latest.id))
      activeExamId = latest.id
    }
  }

  // Supprime la participation du user sur l'examen actif (cascade `exam_answers`).
  // On garde les résultats des autres examens (parité Convex).
  let deletedParticipations = 0
  if (activeExamId) {
    const rows = await db
      .delete(examParticipations)
      .where(
        and(
          eq(examParticipations.userId, u.id),
          eq(examParticipations.examId, activeExamId),
        ),
      )
      .returning({ id: examParticipations.id })
    deletedParticipations = rows.length
  }

  // Supprime TOUTES les sessions d'entraînement du user (pas seulement
  // `in_progress`, cascade `training_session_items`). Remet à zéro la fenêtre du
  // rate-limit (`MAX_SESSIONS_PER_HOUR`) entre les runs e2e et évite les
  // collisions « session déjà en cours » au fil des tests.
  const trainingRows = await db
    .delete(trainingSessions)
    .where(eq(trainingSessions.userId, u.id))
    .returning({ id: trainingSessions.id })

  return {
    userFound: true as const,
    deletedParticipations,
    deletedTrainingSessions: trainingRows.length,
    activeExamId,
  }
}

async function cleanup(prefix: string) {
  // Examens préfixés : DELETE cascade `exam_questions` + `exam_participations`
  // (→ cascade `exam_answers`).
  const examRows = await db
    .delete(exams)
    .where(ilike(exams.title, `${prefix}%`))
    .returning({ id: exams.id })

  // Questions préfixées NON référencées (FK `restrict` depuis exam_questions /
  // exam_answers / training_session_items) → on ne supprime que les orphelines.
  const questionRows = await db
    .delete(questions)
    .where(
      and(
        ilike(questions.question, `${prefix}%`),
        notExists(
          db
            .select({ one: examQuestions.questionId })
            .from(examQuestions)
            .where(eq(examQuestions.questionId, questions.id)),
        ),
        notExists(
          db
            .select({ one: examAnswers.questionId })
            .from(examAnswers)
            .where(eq(examAnswers.questionId, questions.id)),
        ),
        notExists(
          db
            .select({ one: trainingSessionItems.questionId })
            .from(trainingSessionItems)
            .where(eq(trainingSessionItems.questionId, questions.id)),
        ),
      ),
    )
    .returning({ id: questions.id })

  return {
    deletedExams: examRows.length,
    deletedQuestions: questionRows.length,
  }
}

/**
 * Octroie ou révoque un accès (`exam`/`training`) pour un utilisateur.
 * `userAccess.lastTransactionId` est NOT NULL (FK → transactions) : un octroi
 * « depuis zéro » crée donc une transaction manuelle `[E2E]` complétée. Idempotent :
 * si l'accès existe déjà, on prolonge simplement `expiresAt` (pas de nouvelle
 * transaction). Révoquer = supprimer la ligne `userAccess` (la transaction reste).
 */
async function setAccess(
  userEmail: string,
  accessType: "exam" | "training",
  grant: boolean,
) {
  const [u] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, userEmail))
    .limit(1)
  if (!u) return { userFound: false as const }

  if (!grant) {
    const rows = await db
      .delete(userAccess)
      .where(
        and(eq(userAccess.userId, u.id), eq(userAccess.accessType, accessType)),
      )
      .returning({ id: userAccess.id })
    return { userFound: true as const, action: "revoked", count: rows.length }
  }

  const expiresAt = new Date(Date.now() + 365 * DAY_MS)

  const [existing] = await db
    .select({ id: userAccess.id })
    .from(userAccess)
    .where(
      and(eq(userAccess.userId, u.id), eq(userAccess.accessType, accessType)),
    )
    .limit(1)
  if (existing) {
    await db
      .update(userAccess)
      .set({ expiresAt })
      .where(eq(userAccess.id, existing.id))
    return { userFound: true as const, action: "extended" }
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.accessType, accessType))
    .limit(1)
  if (!product) {
    return { userFound: true as const, error: `no ${accessType} product` }
  }

  const now = new Date()
  const txId = createId()
  await db.insert(transactions).values({
    id: txId,
    userId: u.id,
    productId: product.id,
    type: "manual",
    status: "completed",
    amountPaid: 0,
    currency: "CAD",
    accessType,
    durationDays: 365,
    accessExpiresAt: expiresAt,
    completedAt: now,
    notes: "[E2E] grant-access",
  })
  await db.insert(userAccess).values({
    userId: u.id,
    accessType,
    expiresAt,
    lastTransactionId: txId,
  })
  return { userFound: true as const, action: "granted" }
}

/**
 * Crée un examen `restricted` actif (en fenêtre) avec `questionCount` questions
 * de la banque dev et une audience = `audienceUserEmails`. La présence dans
 * `examAudience` OCTROIE l'accès (même sans abonnement) → permet de tester la
 * sémantique F2 (membre sans abo / outsider masqué). Le titre est préfixé
 * `[E2E]` → nettoyé par `cleanup`. Renvoie l'`examId` créé.
 */
async function seedRestrictedExam(opts: {
  title: string
  audienceUserEmails: string[]
  questionCount?: number
}) {
  const count = Math.min(Math.max(1, opts.questionCount ?? 3), 50)

  // createdBy : un admin (FK restrict vers user).
  const [admin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .limit(1)
  if (!admin) return { error: "no admin user" as const }

  // Réutilise des questions existantes de la banque dev (pas de seed de questions).
  const qs = await db
    .select({ id: questions.id })
    .from(questions)
    .limit(count)
  if (qs.length < count) {
    return { error: `not enough questions (${qs.length}/${count})` as const }
  }

  const now = new Date()
  const examId = createId()
  await db.insert(exams).values({
    id: examId,
    title: opts.title,
    description: "[E2E] examen restreint",
    startDate: new Date(now.getTime() - 60_000),
    endDate: new Date(now.getTime() + 30 * DAY_MS),
    completionTime: 3 * 60 * 60, // 3 h en secondes
    enablePause: false,
    isActive: true,
    audienceType: "restricted",
    createdBy: admin.id,
  })
  await db
    .insert(examQuestions)
    .values(qs.map((q, i) => ({ examId, questionId: q.id, position: i })))

  // Audience : la présence (examId, userId) octroie l'accès.
  const emails = [...new Set(opts.audienceUserEmails)]
  let audienceCount = 0
  if (emails.length > 0) {
    const members = await db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.email, emails))
    if (members.length > 0) {
      await db
        .insert(examAudience)
        .values(members.map((m) => ({ examId, userId: m.id })))
      audienceCount = members.length
    }
  }

  return { examId, questionCount: qs.length, audienceCount }
}

export async function POST(request: Request) {
  if (isDisabled()) {
    return new Response("Not found", { status: 404 })
  }

  let body: {
    secret?: string
    action?: string
    userEmail?: string
    prefix?: string
    accessType?: "exam" | "training"
    grant?: boolean
    title?: string
    audienceUserEmails?: string[]
    questionCount?: number
  }
  try {
    body = await request.json()
  } catch {
    return new Response("Invalid body", { status: 400 })
  }

  if (body.secret !== env.E2E_RESET_SECRET) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    if (body.action === "reset-exam") {
      if (!body.userEmail) {
        return new Response("userEmail requis", { status: 400 })
      }
      return Response.json(await resetExam(body.userEmail))
    }
    if (body.action === "cleanup") {
      return Response.json(await cleanup(body.prefix ?? "[E2E]"))
    }
    if (body.action === "set-access") {
      if (!body.userEmail) {
        return new Response("userEmail requis", { status: 400 })
      }
      if (body.accessType !== "exam" && body.accessType !== "training") {
        return new Response("accessType invalide (exam|training)", {
          status: 400,
        })
      }
      return Response.json(
        await setAccess(body.userEmail, body.accessType, body.grant ?? true),
      )
    }
    if (body.action === "seed-restricted-exam") {
      if (!body.title) {
        return new Response("title requis", { status: 400 })
      }
      return Response.json(
        await seedRestrictedExam({
          title: body.title,
          audienceUserEmails: body.audienceUserEmails ?? [],
          questionCount: body.questionCount,
        }),
      )
    }
    return new Response("action inconnue", { status: 400 })
  } catch (error) {
    console.error("[e2e route] échec", error)
    return new Response("E2E handler error", { status: 500 })
  }
}
