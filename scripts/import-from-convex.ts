/* eslint-disable @typescript-eslint/no-explicit-any */
// Idempotent one-shot import: Convex snapshot -> Neon (develop).
// Usage: bun run scripts/import-from-convex.ts [snapshotDir=convex-snapshot]
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { config } from "dotenv"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "@/db/schema"
import { createId } from "@/lib/ids"

config({ path: ".env.local" })

const SNAPSHOT = process.argv[2] ?? "convex-snapshot"
const BATCH = 500

const url = process.env.DATABASE_URL_UNPOOLED
if (!url) throw new Error("DATABASE_URL_UNPOOLED manquant (.env.local)")
const pool = new Pool({ connectionString: url })
const db = drizzle(pool, { schema })

type Doc = Record<string, any>

const read = (table: string): Doc[] => {
  const p = join(SNAPSHOT, table, "documents.jsonl")
  if (!existsSync(p)) {
    console.warn(`[skip] ${table}: documents.jsonl introuvable`)
    return []
  }
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Doc)
}

const ms = (n: number | null | undefined): Date | null =>
  n == null ? null : new Date(n)

const insertedCount: Record<string, number> = {}

const insertBatched = async (
  table: any,
  rows: any[],
  label: string,
): Promise<void> => {
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    if (chunk.length === 0) continue
    const res = await db.insert(table).values(chunk).onConflictDoNothing()
    inserted += res.rowCount ?? 0
  }
  insertedCount[label] = inserted
  const drop = rows.length - inserted
  console.log(
    `[ok] ${label}: ${inserted}/${rows.length} insérée(s)` +
      (drop > 0 ? ` ⚠️  ${drop} ignorée(s) sur conflit` : ""),
  )
}

const report: Record<string, number> = {}
const dropped: string[] = []
const note = (msg: string) => {
  dropped.push(msg)
  console.warn(`[orphan] ${msg}`)
}

async function main() {
  // 1. products (no FK)
  const products = read("products").map((d) => ({
    id: d._id,
    code: d.code,
    name: d.name,
    description: d.description,
    priceCad: d.priceCAD,
    durationDays: d.durationDays,
    accessType: d.accessType,
    stripeProductId: d.stripeProductId,
    stripePriceId: d.stripePriceId,
    isActive: d.isActive,
    isCombo: d.isCombo ?? false,
    createdAt: ms(d._creationTime),
    updatedAt: ms(d._creationTime),
  }))
  const productIds = new Set(products.map((p) => p.id))
  await insertBatched(schema.products, products, "products")
  report.products = products.length

  // 2. questions + 3. explanations + 4. question_images
  const questionDocs = read("questions")
  const questionIds = new Set(questionDocs.map((d) => d._id))
  const questions = questionDocs.map((d) => ({
    id: d._id,
    question: d.question,
    correctAnswer: d.correctAnswer,
    options: d.options,
    objectifCmc: d.objectifCMC,
    domain: d.domain,
    deletedAt: null,
    createdAt: ms(d._creationTime),
    updatedAt: ms(d._creationTime),
  }))
  await insertBatched(schema.questions, questions, "questions")
  report.questions = questions.length

  const questionImages: any[] = []
  for (const d of questionDocs) {
    if (Array.isArray(d.images)) {
      for (const img of d.images) {
        questionImages.push({
          id: createId(),
          questionId: d._id,
          storagePath: img.storagePath,
          position: img.order,
          createdAt: ms(d._creationTime),
        })
      }
    }
  }
  await insertBatched(schema.questionImages, questionImages, "question_images")
  report.question_images = questionImages.length

  const explanations = read("questionExplanations")
    .filter((d) => {
      if (questionIds.has(d.questionId)) return true
      note(`explanation ${d._id} -> question ${d.questionId} absente`)
      return false
    })
    .map((d) => ({
      questionId: d.questionId,
      explanation: d.explanation,
      references: d.references ?? null,
      imagePath: null,
    }))
  await insertBatched(
    schema.questionExplanations,
    explanations,
    "question_explanations",
  )
  report.question_explanations = explanations.length

  // 5. users (dedup email + username)
  const userDocs = read("users")
  const seenEmail = new Set<string>()
  const seenUsername = new Set<string>()
  const users: any[] = []
  for (const d of userDocs) {
    if (seenEmail.has(d.email)) {
      note(`user ${d._id}: email "${d.email}" doublon -> ignoré`)
      continue
    }
    seenEmail.add(d.email)
    let username: string | null = d.username ?? null
    if (username && seenUsername.has(username)) {
      note(`user ${d._id}: username "${username}" doublon -> null`)
      username = null
    }
    if (username) seenUsername.add(username)
    users.push({
      id: d._id,
      name: d.name,
      email: d.email,
      emailVerified: true,
      // Proxéa: store the Bunny path; fall back to external (Clerk) URL.
      image: d.avatarStoragePath ?? d.image ?? null,
      role: d.role,
      username,
      bio: d.bio ?? null,
      createdAt: ms(d._creationTime),
      updatedAt: ms(d._creationTime),
    })
  }
  const userIds = new Set(users.map((u) => u.id))
  await insertBatched(schema.user, users, "user")
  report.user = users.length

  // 6. exams + 7. exam_questions
  const examDocs = read("exams")
  const exams: any[] = []
  for (const d of examDocs) {
    if (!userIds.has(d.createdBy)) {
      note(`exam ${d._id}: createdBy ${d.createdBy} absent -> ignoré`)
      continue
    }
    exams.push({
      id: d._id,
      title: d.title,
      description: d.description ?? null,
      startDate: ms(d.startDate),
      endDate: ms(d.endDate),
      completionTime: d.completionTime,
      enablePause: d.enablePause ?? false,
      pauseDurationMinutes: d.pauseDurationMinutes ?? null,
      isActive: d.isActive,
      createdBy: d.createdBy,
      createdAt: ms(d._creationTime),
      updatedAt: ms(d._creationTime),
    })
  }
  const examIds = new Set(exams.map((e) => e.id))
  await insertBatched(schema.exams, exams, "exams")
  report.exams = exams.length

  const examQuestions: any[] = []
  for (const d of examDocs) {
    if (!examIds.has(d._id)) continue
    const ids: string[] = Array.isArray(d.questionIds) ? d.questionIds : []
    ids.forEach((qid, position) => {
      if (!questionIds.has(qid)) {
        note(`exam ${d._id}: question ${qid} absente -> lien ignoré`)
        return
      }
      examQuestions.push({ examId: d._id, questionId: qid, position })
    })
  }
  await insertBatched(schema.examQuestions, examQuestions, "exam_questions")
  report.exam_questions = examQuestions.length

  // 8. transactions
  const transactions: any[] = []
  for (const d of read("transactions")) {
    if (!userIds.has(d.userId)) {
      note(`transaction ${d._id}: user ${d.userId} absent -> ignoré`)
      continue
    }
    if (!productIds.has(d.productId)) {
      note(`transaction ${d._id}: product ${d.productId} absent -> ignoré`)
      continue
    }
    transactions.push({
      id: d._id,
      userId: d.userId,
      productId: d.productId,
      type: d.type,
      status: d.status,
      amountPaid: d.amountPaid,
      currency: d.currency,
      stripeSessionId: d.stripeSessionId ?? null,
      stripePaymentIntentId: d.stripePaymentIntentId ?? null,
      stripeEventId: d.stripeEventId ?? null,
      paymentMethod: d.paymentMethod ?? null,
      recordedBy: d.recordedBy && userIds.has(d.recordedBy) ? d.recordedBy : null,
      notes: d.notes ?? null,
      accessType: d.accessType,
      durationDays: d.durationDays,
      accessExpiresAt: ms(d.accessExpiresAt),
      createdAt: ms(d.createdAt),
      completedAt: d.completedAt ? ms(d.completedAt) : null,
    })
  }
  const transactionIds = new Set(transactions.map((t) => t.id))
  await insertBatched(schema.transactions, transactions, "transactions")
  report.transactions = transactions.length

  // 9. user_access
  const userAccess: any[] = []
  for (const d of read("userAccess")) {
    if (!userIds.has(d.userId)) {
      note(`userAccess ${d._id}: user ${d.userId} absent -> ignoré`)
      continue
    }
    if (!transactionIds.has(d.lastTransactionId)) {
      note(`userAccess ${d._id}: transaction ${d.lastTransactionId} absente -> ignoré`)
      continue
    }
    userAccess.push({
      id: d._id,
      userId: d.userId,
      accessType: d.accessType,
      expiresAt: ms(d.expiresAt),
      lastTransactionId: d.lastTransactionId,
      createdAt: ms(d._creationTime),
      updatedAt: ms(d._creationTime),
    })
  }
  await insertBatched(schema.userAccess, userAccess, "user_access")
  report.user_access = userAccess.length

  // 10. exam_participations — dédupliqué par (examId, userId) AVANT insert.
  // La table impose unique(exam_id, user_id) ; sans dédup explicite,
  // onConflictDoNothing dropperait un doublon ET ses exam_answers dangleraient
  // (violation FK -> crash de l'import). On garde la "meilleure" : score le plus
  // élevé, puis complétion la plus récente. participationIds est construit depuis
  // l'ensemble DÉDUPLIQUÉ -> les réponses du doublon écarté sont aussi exclues.
  const partByKey = new Map<string, any>()
  let partDupes = 0
  for (const d of read("examParticipations")) {
    if (!examIds.has(d.examId)) {
      note(`examParticipation ${d._id}: exam ${d.examId} absent -> ignoré`)
      continue
    }
    if (!userIds.has(d.userId)) {
      note(`examParticipation ${d._id}: user ${d.userId} absent -> ignoré`)
      continue
    }
    const row = {
      id: d._id,
      examId: d.examId,
      userId: d.userId,
      score: d.score,
      status: d.status ?? "in_progress",
      startedAt: d.startedAt ? ms(d.startedAt) : null,
      completedAt: d.completedAt && d.completedAt !== 0 ? ms(d.completedAt) : null,
      pausePhase: d.pausePhase ?? null,
      pauseStartedAt: d.pauseStartedAt ? ms(d.pauseStartedAt) : null,
      pauseEndedAt: d.pauseEndedAt ? ms(d.pauseEndedAt) : null,
      isPauseCutShort: d.isPauseCutShort ?? null,
      totalPauseDurationMs: d.totalPauseDurationMs ?? null,
      createdAt: ms(d._creationTime),
    }
    const key = `${d.examId}::${d.userId}`
    const prev = partByKey.get(key)
    if (!prev) {
      partByKey.set(key, row)
      continue
    }
    partDupes++
    const prevScore = prev.score ?? -1
    const rowScore = row.score ?? -1
    const better =
      rowScore !== prevScore
        ? rowScore > prevScore
        : (row.completedAt?.getTime() ?? 0) > (prev.completedAt?.getTime() ?? 0)
    if (better) partByKey.set(key, row)
    note(
      `examParticipation doublon (exam ${d.examId}, user ${d.userId}) -> 1 gardée (meilleur score/complétion)`,
    )
  }
  const participations = [...partByKey.values()]
  const participationIds = new Set(participations.map((p) => p.id))
  await insertBatched(
    schema.examParticipations,
    participations,
    "exam_participations",
  )
  report.exam_participations = participations.length
  if (partDupes > 0)
    console.log(
      `[info] ${partDupes} participation(s) en doublon (exam,user) dédupliquée(s)`,
    )

  // 11. exam_answers
  const examAnswers: any[] = []
  for (const d of read("examAnswers")) {
    if (!participationIds.has(d.participationId)) continue
    if (!questionIds.has(d.questionId)) {
      note(`examAnswer ${d._id}: question ${d.questionId} absente -> ignoré`)
      continue
    }
    examAnswers.push({
      id: d._id,
      participationId: d.participationId,
      questionId: d.questionId,
      selectedAnswer: d.selectedAnswer,
      isCorrect: d.isCorrect,
      isFlagged: d.isFlagged ?? false,
      createdAt: ms(d._creationTime),
    })
  }
  await insertBatched(schema.examAnswers, examAnswers, "exam_answers")
  report.exam_answers = examAnswers.length

  // 12. training_sessions (skip in_progress — D9)
  const trainingSessions: any[] = []
  const sessionQuestionIds = new Map<string, string[]>()
  let skippedInProgress = 0
  for (const d of read("trainingParticipations")) {
    if (!userIds.has(d.userId)) {
      note(`trainingParticipation ${d._id}: user ${d.userId} absent -> ignoré`)
      continue
    }
    if (d.status === "in_progress") {
      skippedInProgress++
      continue
    }
    trainingSessions.push({
      id: d._id,
      userId: d.userId,
      status: d.status,
      domain: d.domain ?? null,
      objectifCmc: null,
      questionCount: d.questionCount,
      score: d.score ?? null,
      startedAt: ms(d.startedAt),
      completedAt: d.completedAt ? ms(d.completedAt) : null,
      expiresAt: ms(d.expiresAt),
      createdAt: ms(d._creationTime),
      updatedAt: ms(d._creationTime),
    })
    sessionQuestionIds.set(d._id, Array.isArray(d.questionIds) ? d.questionIds : [])
  }
  const sessionIds = new Set(trainingSessions.map((s) => s.id))
  await insertBatched(schema.trainingSessions, trainingSessions, "training_sessions")
  report.training_sessions = trainingSessions.length
  if (skippedInProgress > 0)
    console.log(`[info] ${skippedInProgress} sessions training in_progress non migrées`)

  // 13. training_session_items: build from session questionIds[], merge answers
  const answerByKey = new Map<string, Doc>()
  for (const a of read("trainingAnswers")) {
    if (sessionIds.has(a.participationId)) {
      answerByKey.set(`${a.participationId}::${a.questionId}`, a)
    }
  }
  const items: any[] = []
  for (const [sessionId, qids] of sessionQuestionIds) {
    qids.forEach((qid, position) => {
      if (!questionIds.has(qid)) {
        note(`training ${sessionId}: question ${qid} absente -> item ignoré`)
        return
      }
      const a = answerByKey.get(`${sessionId}::${qid}`)
      items.push({
        id: createId(),
        sessionId,
        questionId: qid,
        position,
        selectedAnswer: a ? a.selectedAnswer : null,
        isCorrect: a ? a.isCorrect : null,
        answeredAt: a ? ms(a._creationTime) : null,
      })
    })
  }
  await insertBatched(schema.trainingSessionItems, items, "training_session_items")
  report.training_session_items = items.length

  console.log("\n=== RÉSUMÉ IMPORT (inséré / tenté) ===")
  const summary = Object.keys(report).map((k) => ({
    table: k,
    tenté: report[k],
    inséré: insertedCount[k] ?? report[k],
    droppé: report[k] - (insertedCount[k] ?? report[k]),
  }))
  console.table(summary)
  const totalDropped = summary.reduce((s, r) => s + r.droppé, 0)
  if (totalDropped > 0)
    console.warn(
      `⚠️  ${totalDropped} ligne(s) droppée(s) silencieusement sur conflit (déjà présent / contrainte unique) — voir les [ok] ci-dessus.`,
    )
  console.log(`Orphelins/doublons FK ignorés: ${dropped.length}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
