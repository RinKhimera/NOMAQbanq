import { and, desc, eq, gt, ilike, inArray, lte, notExists } from "drizzle-orm"
import { db } from "@/db"
import {
  examAnswers,
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  products,
  questionImages,
  questions,
  quizRateLimits,
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

  // Purge les compteurs du rate-limit quiz public (#91) : en local toutes les
  // requêtes partagent un bucket IP → sans purge, les runs e2e successifs de
  // evaluation-quiz.spec.ts saturent la limite (30/h) et la suite flake.
  const quizRateLimitRows = await db
    .delete(quizRateLimits)
    .returning({ id: quizRateLimits.id })

  return {
    userFound: true as const,
    deletedParticipations,
    deletedTrainingSessions: trainingRows.length,
    deletedQuizRateLimits: quizRateLimitRows.length,
    activeExamId,
  }
}

async function cleanup(prefix: string) {
  // Avant de supprimer les examens préfixés : réclamer les images d'explication
  // seedées sur leurs questions. Ces questions sont PARTAGÉES (banque dev) → la
  // cascade d'examen ne les emporte pas. Sans ça, un run interrompu avant le
  // `remove` de la spec laisse une image `kind='explanation'` orpheline (image
  // cassée à la correction en dev).
  const seededExams = await db
    .select({ id: exams.id })
    .from(exams)
    .where(ilike(exams.title, `${prefix}%`))
  if (seededExams.length > 0) {
    const qRows = await db
      .select({ questionId: examQuestions.questionId })
      .from(examQuestions)
      .where(
        inArray(
          examQuestions.examId,
          seededExams.map((e) => e.id),
        ),
      )
    const questionIds = [...new Set(qRows.map((r) => r.questionId))]
    if (questionIds.length > 0) {
      await db
        .delete(questionImages)
        .where(
          and(
            inArray(questionImages.questionId, questionIds),
            eq(questionImages.kind, "explanation"),
          ),
        )
    }
  }

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
  const qs = await db.select({ id: questions.id }).from(questions).limit(count)
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

/**
 * Crée un examen `subscribers` DÉDIÉ (un par fichier de spec) pour isoler les
 * specs `examen-blanc*` des collisions d'état partagé : sans ça, il n'existe
 * qu'UN examen actif en fenêtre (le reset), et le premier fichier qui le
 * consomme (auto-submit) casse les suivants (« Déjà passé »). Le student a déjà
 * l'accès `exam` (octroyé en global.setup) → un examen `subscribers` lui est
 * éligible. Titre préfixé `[E2E]` → nettoyé par `cleanup`.
 *
 * Options :
 *  - `enablePause` : active la pause repos (pour la spec pause) ;
 *  - `closed` : fenêtre PASSÉE (endDate révolu). Requis pour la spec résultats —
 *    `getParticipantExamResults` ne révèle les résultats à un non-admin qu'APRÈS
 *    `endDate` (anti-fuite F3) ;
 *  - `completedFor` : seed en plus une participation COMPLÉTÉE (mix correct /
 *    incorrect déterministe) pour cet utilisateur → la page résultats a des
 *    données sans rejouer toute la passation.
 */
async function seedExam(opts: {
  title: string
  questionCount?: number
  enablePause?: boolean
  closed?: boolean
  completedFor?: string
}) {
  const count = Math.min(Math.max(1, opts.questionCount ?? 5), 50)

  const [admin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .limit(1)
  if (!admin) return { error: "no admin user" as const }

  // Questions de la banque dev AVEC correctAnswer/options (nécessaires pour
  // calculer le mix correct/incorrect d'une participation complétée).
  const qs = await db
    .select({
      id: questions.id,
      correctAnswer: questions.correctAnswer,
      options: questions.options,
    })
    .from(questions)
    .limit(count)
  if (qs.length < count) {
    return { error: `not enough questions (${qs.length}/${count})` as const }
  }

  const now = Date.now()
  // SECONDS_PER_QUESTION = 83 (cf. features/exams/schemas.ts) — court, pour que
  // le fastForward(3h) de l'auto-submit dépasse toujours le budget-temps.
  const completionTime = count * 83
  const startDate = opts.closed
    ? new Date(now - 2 * 60 * 60 * 1000) // ouvert il y a 2 h…
    : new Date(now - 60_000)
  const endDate = opts.closed
    ? new Date(now - 60_000) // …clos il y a 1 min
    : new Date(now + 30 * DAY_MS)

  const examId = createId()
  await db.insert(exams).values({
    id: examId,
    title: opts.title,
    description: "[E2E] examen dédié (spec)",
    startDate,
    endDate,
    completionTime,
    enablePause: opts.enablePause ?? false,
    pauseDurationMinutes: opts.enablePause ? 15 : null,
    isActive: true,
    audienceType: "subscribers",
    createdBy: admin.id,
  })
  await db
    .insert(examQuestions)
    .values(qs.map((q, i) => ({ examId, questionId: q.id, position: i })))

  let participationId: string | null = null
  let score: number | null = null
  if (opts.completedFor) {
    const [member] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, opts.completedFor))
      .limit(1)
    if (!member) return { error: "completedFor user not found" as const }

    // Mix déterministe : index pair → bonne réponse, impair → mauvaise. Donne
    // un mélange correct/incorrect (badge + filtre « erreurs » testables).
    // Cas dégénéré (question sans distracteur : toutes options = correctAnswer) :
    // pas de mauvaise réponse possible → la réponse EST correcte. Garantit
    // `selectedAnswer === correctAnswer ⟺ isCorrect` (jamais « bonne option
    // marquée fausse »).
    const answers = qs.map((q, i) => {
      const wrong = q.options.find((o) => o !== q.correctAnswer)
      // Bonne réponse si index pair OU s'il n'existe aucun distracteur.
      if (i % 2 === 0 || wrong === undefined) {
        return {
          questionId: q.id,
          selectedAnswer: q.correctAnswer,
          isCorrect: true,
        }
      }
      return { questionId: q.id, selectedAnswer: wrong, isCorrect: false }
    })
    const correctCount = answers.filter((a) => a.isCorrect).length
    score = Math.round((correctCount / count) * 100)

    participationId = createId()
    await db.insert(examParticipations).values({
      id: participationId,
      examId,
      userId: member.id,
      status: "completed",
      score,
      startedAt: new Date(now - 60 * 60 * 1000),
      completedAt: new Date(now - 30 * 60 * 1000),
    })
    await db.insert(examAnswers).values(
      answers.map((a) => ({
        participationId: participationId!,
        questionId: a.questionId,
        selectedAnswer: a.selectedAnswer,
        isCorrect: a.isCorrect,
        isFlagged: false,
      })),
    )
  }

  return { examId, questionCount: qs.length, participationId, score }
}

/**
 * Attache (ou retire si `remove`) une image d'explication (`kind='explanation'`)
 * à la PREMIÈRE question d'un examen. Permet de tester F3 : l'anti-triche garantit
 * que cette image n'apparaît JAMAIS en passation (la DAL de passation ne lit pas le
 * canal explication), seulement à la correction. Idempotent. `remove` nettoie la
 * question partagée de la banque (la cascade d'examen ne touche pas `questionImages`).
 */
async function seedExplanationImage(opts: {
  examId: string
  remove?: boolean
}) {
  const [q] = await db
    .select({ questionId: examQuestions.questionId })
    .from(examQuestions)
    .where(
      and(eq(examQuestions.examId, opts.examId), eq(examQuestions.position, 0)),
    )
    .limit(1)
  if (!q) return { error: "exam first question not found" as const }

  // Toujours nettoyer l'éventuelle image d'explication existante (idempotent + remove).
  await db
    .delete(questionImages)
    .where(
      and(
        eq(questionImages.questionId, q.questionId),
        eq(questionImages.kind, "explanation"),
      ),
    )

  if (opts.remove) return { questionId: q.questionId, removed: true as const }

  const storagePath = `questions/${q.questionId}/explanation/0.jpg`
  await db.insert(questionImages).values({
    questionId: q.questionId,
    storagePath,
    position: 0,
    kind: "explanation",
  })
  return { questionId: q.questionId, storagePath }
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
    examId?: string
    remove?: boolean
    enablePause?: boolean
    closed?: boolean
    completedFor?: string
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
    if (body.action === "seed-exam") {
      if (!body.title) {
        return new Response("title requis", { status: 400 })
      }
      return Response.json(
        await seedExam({
          title: body.title,
          questionCount: body.questionCount,
          enablePause: body.enablePause,
          closed: body.closed,
          completedFor: body.completedFor,
        }),
      )
    }
    if (body.action === "seed-explanation-image") {
      if (!body.examId) {
        return new Response("examId requis", { status: 400 })
      }
      return Response.json(
        await seedExplanationImage({
          examId: body.examId,
          remove: body.remove,
        }),
      )
    }
    return new Response("action inconnue", { status: 400 })
  } catch (error) {
    console.error("[e2e route] échec", error)
    return new Response("E2E handler error", { status: 500 })
  }
}
