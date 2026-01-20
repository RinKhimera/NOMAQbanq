import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getCurrentUserOrNull, getCurrentUserOrThrow } from "./lib/auth"
import { batchGetOrderedByIds } from "./lib/batchFetch"
import { Errors } from "./lib/errors"

// ============================================
// CONSTANTS
// ============================================

const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 heures
const MIN_QUESTIONS = 5
const MAX_QUESTIONS = 20

// ============================================
// QUERIES
// ============================================

/**
 * Récupère la session d'entraînement active de l'utilisateur (si existante)
 */
export const getActiveTrainingSession = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) return null

    const now = Date.now()

    // Trouver une session en cours
    const activeSession = await ctx.db
      .query("trainingParticipations")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "in_progress"),
      )
      .first()

    if (!activeSession) return null

    // Vérifier si expirée
    if (activeSession.expiresAt < now) {
      return {
        session: activeSession,
        isExpired: true,
        canResume: false,
        remainingTimeMs: 0,
      }
    }

    return {
      session: activeSession,
      isExpired: false,
      canResume: true,
      remainingTimeMs: activeSession.expiresAt - now,
    }
  },
})

/**
 * Récupère une session par son ID avec les questions et réponses
 * IMPORTANT: Pour les sessions en cours, les correctAnswer/explanation sont masquées
 */
export const getTrainingSessionById = query({
  args: {
    sessionId: v.id("trainingParticipations"),
  },
  handler: async (ctx, { sessionId }) => {
    const user = await getCurrentUserOrThrow(ctx)

    const session = await ctx.db.get(sessionId)
    if (!session) return null

    // Vérifier propriété (ou admin)
    if (session.userId !== user._id && user.role !== "admin") {
      return null
    }

    // Récupérer les questions (batch fetch)
    const rawQuestions = await batchGetOrderedByIds(
      ctx,
      "questions",
      session.questionIds,
    )

    // Récupérer les réponses existantes
    const answers = await ctx.db
      .query("trainingAnswers")
      .withIndex("by_participation", (q) => q.eq("participationId", sessionId))
      .collect()

    // Créer un map questionId -> answer
    const answersMap = Object.fromEntries(
      answers.map((a) => [a.questionId.toString(), a]),
    )

    const isCompleted = session.status === "completed"

    // Pour les sessions en cours, masquer les réponses correctes (anti-triche)
    const questions = rawQuestions.filter(Boolean).map((q) => {
      if (!q) return null
      if (isCompleted) {
        return q // Session terminée : retourner tout
      }
      // Session en cours : masquer correctAnswer et explanation
      return {
        _id: q._id,
        _creationTime: q._creationTime,
        question: q.question,
        images: q.images,
        options: q.options,
        objectifCMC: q.objectifCMC,
        domain: q.domain,
        references: q.references,
        // correctAnswer et explanation sont omis
      }
    })

    return {
      session,
      questions: questions.filter(Boolean),
      answers: answersMap,
      isExpired: session.expiresAt < Date.now(),
    }
  },
})

/**
 * Récupère l'historique des sessions d'entraînement (paginé)
 * Note: Utilise l'index by_user_status pour ne récupérer que les sessions completed
 */
export const getTrainingHistory = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { paginationOpts }) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return { page: [], continueCursor: "", isDone: true }
    }

    // Utiliser l'index by_user_status pour filtrer directement les completed
    const result = await ctx.db
      .query("trainingParticipations")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed"),
      )
      .order("desc")
      .paginate(paginationOpts)

    // Mapper vers le format attendu
    const completedSessions = result.page.map((session) => ({
      _id: session._id,
      questionCount: session.questionCount,
      score: session.score,
      completedAt: session.completedAt,
      domain: session.domain,
      startedAt: session.startedAt,
    }))

    return {
      page: completedSessions,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    }
  },
})

/**
 * Récupère les résultats détaillés d'une session terminée
 */
export const getTrainingSessionResults = query({
  args: {
    sessionId: v.id("trainingParticipations"),
  },
  handler: async (ctx, { sessionId }) => {
    const user = await getCurrentUserOrThrow(ctx)

    const session = await ctx.db.get(sessionId)
    if (!session) return null

    // Vérifier propriété (ou admin)
    if (session.userId !== user._id && user.role !== "admin") {
      return null
    }

    // Doit être terminée
    if (session.status !== "completed") {
      return { error: "SESSION_NOT_COMPLETED" as const }
    }

    // Récupérer toutes les questions avec détails complets (batch fetch)
    const questions = await batchGetOrderedByIds(
      ctx,
      "questions",
      session.questionIds,
    )

    // Récupérer toutes les réponses
    const answers = await ctx.db
      .query("trainingAnswers")
      .withIndex("by_participation", (q) => q.eq("participationId", sessionId))
      .collect()

    // Créer un map pour accès rapide
    const answersMap = Object.fromEntries(
      answers.map((a) => [a.questionId, a]),
    )

    return {
      session: {
        _id: session._id,
        score: session.score,
        questionCount: session.questionCount,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        domain: session.domain,
      },
      questions: questions.filter(Boolean),
      answers: answersMap,
    }
  },
})

/**
 * Récupère la liste des domaines disponibles avec le nombre de questions
 * Utile pour le sélecteur de domaine dans le frontend
 */
export const getAvailableDomains = query({
  args: {},
  handler: async (ctx) => {
    // Utiliser la table d'agrégation questionStats si disponible
    const stats = await ctx.db.query("questionStats").collect()

    if (stats.length > 0) {
      // Utiliser les stats d'agrégation (plus performant)
      const domains = stats
        .filter((s) => s.domain !== "__total__")
        .map((s) => ({
          domain: s.domain,
          count: s.count,
        }))
        .sort((a, b) => b.count - a.count)

      const total = stats.find((s) => s.domain === "__total__")?.count ?? 0

      return {
        domains,
        totalQuestions: total,
      }
    }

    // Fallback: calculer depuis la table questions (si questionStats non peuplée)
    // Limited to 2000 questions for performance; ideally questionStats should be used
    const allQuestions = await ctx.db.query("questions").take(2000)

    const domainCounts = allQuestions.reduce(
      (acc, q) => {
        acc[q.domain] = (acc[q.domain] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const domains = Object.entries(domainCounts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)

    return {
      domains,
      totalQuestions: allQuestions.length,
    }
  },
})

/**
 * Récupère les statistiques d'entraînement pour le dashboard
 */
export const getTrainingStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) return null

    // Récupérer toutes les sessions terminées
    const completedSessions = await ctx.db
      .query("trainingParticipations")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed"),
      )
      .collect()

    const totalSessions = completedSessions.length
    const totalQuestions = completedSessions.reduce(
      (sum, s) => sum + s.questionCount,
      0,
    )
    const averageScore =
      totalSessions > 0
        ? Math.round(
            completedSessions.reduce((sum, s) => sum + s.score, 0) /
              totalSessions,
          )
        : 0

    // Récupérer les 5 dernières sessions pour le graphique
    const recentSessions = completedSessions
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 5)
      .map((s) => ({
        score: s.score,
        completedAt: s.completedAt,
        questionCount: s.questionCount,
      }))

    return {
      totalSessions,
      totalQuestions,
      averageScore,
      recentSessions,
    }
  },
})

// ============================================
// MUTATIONS
// ============================================

/**
 * Crée une nouvelle session d'entraînement avec des questions aléatoires
 */
export const createTrainingSession = mutation({
  args: {
    questionCount: v.number(),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, { questionCount, domain }) => {
    const user = await getCurrentUserOrThrow(ctx)

    // 1. Vérifier accès training (admin bypass)
    if (user.role !== "admin") {
      const access = await ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "training"),
        )
        .unique()

      if (!access || access.expiresAt < Date.now()) {
        throw new Error(
          "Accès à l'entraînement requis. Veuillez souscrire un abonnement.",
        )
      }
    }

    // 2. Valider le nombre de questions (doit être un entier entre MIN et MAX)
    if (
      !Number.isInteger(questionCount) ||
      questionCount < MIN_QUESTIONS ||
      questionCount > MAX_QUESTIONS
    ) {
      throw new Error(
        `Le nombre de questions doit être un entier entre ${MIN_QUESTIONS} et ${MAX_QUESTIONS}`,
      )
    }

    // 3. Vérifier s'il y a une session en cours
    const existingSession = await ctx.db
      .query("trainingParticipations")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "in_progress"),
      )
      .first()

    if (existingSession) {
      // Si non expirée, erreur
      if (existingSession.expiresAt >= Date.now()) {
        throw new Error(
          "Vous avez déjà une session en cours. Veuillez la terminer ou attendre son expiration.",
        )
      }
      // Si expirée, marquer comme abandonnée
      await ctx.db.patch(existingSession._id, { status: "abandoned" })
    }

    // 4. Sélectionner les questions
    // Sample more than needed to ensure enough for shuffling (3x requested or 500 minimum)
    const sampleSize = Math.max(questionCount * 3, 500)
    let questions
    if (domain && domain !== "all") {
      questions = await ctx.db
        .query("questions")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .take(sampleSize)
    } else {
      questions = await ctx.db.query("questions").take(sampleSize)
    }

    // 5. Valider qu'il y a assez de questions
    if (questions.length < questionCount) {
      throw new Error(
        `Seulement ${questions.length} questions disponibles. Réduisez le nombre demandé.`,
      )
    }

    // 6. Mélanger les questions (Fisher-Yates shuffle)
    const shuffled = [...questions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    const selectedQuestions = shuffled.slice(0, questionCount)
    const questionIds = selectedQuestions.map((q) => q._id)

    // 7. Créer la session
    const now = Date.now()
    const sessionId = await ctx.db.insert("trainingParticipations", {
      userId: user._id,
      questionCount,
      questionIds,
      score: 0,
      status: "in_progress",
      startedAt: now,
      expiresAt: now + SESSION_EXPIRATION_MS,
      domain: domain === "all" ? undefined : domain,
    })

    return {
      sessionId,
      questionIds,
      expiresAt: now + SESSION_EXPIRATION_MS,
    }
  },
})

/**
 * Sauvegarde une réponse à une question (ou met à jour si déjà répondue)
 */
export const saveTrainingAnswer = mutation({
  args: {
    sessionId: v.id("trainingParticipations"),
    questionId: v.id("questions"),
    selectedAnswer: v.string(),
  },
  handler: async (ctx, { sessionId, questionId, selectedAnswer }) => {
    const user = await getCurrentUserOrThrow(ctx)

    // 0. Re-verify training access (admin bypass)
    if (user.role !== "admin") {
      const access = await ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "training"),
        )
        .unique()

      if (!access || access.expiresAt < Date.now()) {
        throw Errors.accessExpired("training")
      }
    }

    // 1. Vérifier propriété de la session
    const session = await ctx.db.get(sessionId)
    if (!session) {
      throw Errors.notFound("Session")
    }

    if (session.userId !== user._id) {
      throw Errors.unauthorized("Cette session ne vous appartient pas")
    }

    // 2. Vérifier que la session est active
    if (session.status !== "in_progress") {
      throw Errors.invalidState("Cette session n'est plus active")
    }

    if (session.expiresAt < Date.now()) {
      // Marquer comme abandonnée
      await ctx.db.patch(sessionId, { status: "abandoned" })
      throw new Error("Cette session a expiré")
    }

    // 3. Vérifier que la question fait partie de la session
    if (!session.questionIds.includes(questionId)) {
      throw new Error("Cette question ne fait pas partie de la session")
    }

    // 4. Récupérer la bonne réponse
    const question = await ctx.db.get(questionId)
    if (!question) {
      throw new Error("Question non trouvée")
    }

    const isCorrect = selectedAnswer === question.correctAnswer

    // 5. Vérifier si une réponse existe déjà
    const existingAnswers = await ctx.db
      .query("trainingAnswers")
      .withIndex("by_participation", (q) => q.eq("participationId", sessionId))
      .collect()

    const existing = existingAnswers.find(
      (a) => a.questionId === questionId,
    )

    if (existing) {
      // Mettre à jour la réponse existante
      await ctx.db.patch(existing._id, {
        selectedAnswer,
        isCorrect,
      })
      return { answerId: existing._id, isCorrect }
    }

    // 6. Créer une nouvelle réponse
    const answerId = await ctx.db.insert("trainingAnswers", {
      participationId: sessionId,
      questionId,
      selectedAnswer,
      isCorrect,
    })

    return { answerId, isCorrect }
  },
})

/**
 * Termine une session et calcule le score final
 */
export const completeTrainingSession = mutation({
  args: {
    sessionId: v.id("trainingParticipations"),
  },
  handler: async (ctx, { sessionId }) => {
    const user = await getCurrentUserOrThrow(ctx)

    // 0. Re-verify training access (admin bypass)
    if (user.role !== "admin") {
      const access = await ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "training"),
        )
        .unique()

      if (!access || access.expiresAt < Date.now()) {
        throw Errors.accessExpired("training")
      }
    }

    // 1. Vérifier propriété
    const session = await ctx.db.get(sessionId)
    if (!session) {
      throw Errors.notFound("Session")
    }

    if (session.userId !== user._id) {
      throw Errors.unauthorized("Cette session ne vous appartient pas")
    }

    // 2. Vérifier status
    if (session.status !== "in_progress") {
      throw Errors.invalidState("Cette session n'est plus active")
    }

    // 3. Récupérer toutes les réponses
    const answers = await ctx.db
      .query("trainingAnswers")
      .withIndex("by_participation", (q) => q.eq("participationId", sessionId))
      .collect()

    // 4. Calculer le score
    const correctCount = answers.filter((a) => a.isCorrect).length
    const totalQuestions = session.questionCount
    const score = Math.round((correctCount / totalQuestions) * 100)

    // 5. Mettre à jour la session
    const now = Date.now()
    await ctx.db.patch(sessionId, {
      status: "completed",
      score,
      completedAt: now,
    })

    return {
      score,
      correctCount,
      totalQuestions,
      completedAt: now,
    }
  },
})

/**
 * Abandonne manuellement une session en cours
 */
export const abandonTrainingSession = mutation({
  args: {
    sessionId: v.id("trainingParticipations"),
  },
  handler: async (ctx, { sessionId }) => {
    const user = await getCurrentUserOrThrow(ctx)

    const session = await ctx.db.get(sessionId)
    if (!session) {
      throw new Error("Session non trouvée")
    }

    if (session.userId !== user._id) {
      throw new Error("Cette session ne vous appartient pas")
    }

    if (session.status !== "in_progress") {
      throw new Error("Cette session n'est pas en cours")
    }

    await ctx.db.patch(sessionId, { status: "abandoned" })

    return { success: true }
  },
})
