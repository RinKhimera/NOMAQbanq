import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import {
  getAdminUserOrThrow,
  getCurrentUserOrNull,
  getCurrentUserOrThrow,
} from "./lib/auth"
import { batchGetByIds, batchGetOrderedByIds } from "./lib/batchFetch"
import { Errors } from "./lib/errors"

// Créer un nouvel examen
export const createExam = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    questionIds: v.array(v.id("questions")),
    enablePause: v.optional(v.boolean()),
    pauseDurationMinutes: v.optional(v.number()),
  },
  returns: v.id("exams"),
  handler: async (ctx, args) => {
    const user = await getAdminUserOrThrow(ctx)

    const completionTime = args.questionIds.length * 83

    // Pause is enabled if explicitly set by admin
    const enablePause = args.enablePause ?? false

    // Pause duration: default 15 minutes if enabled, max 60 minutes
    const pauseDurationMinutes = enablePause
      ? Math.min(args.pauseDurationMinutes ?? 15, 60)
      : undefined

    const examId = await ctx.db.insert("exams", {
      title: args.title,
      description: args.description,
      startDate: args.startDate,
      endDate: args.endDate,
      questionIds: args.questionIds,
      completionTime,
      enablePause: enablePause || undefined,
      pauseDurationMinutes,
      isActive: true,
      createdBy: user._id,
    })

    return examId
  },
})

// Modifier un examen
export const updateExam = mutation({
  args: {
    examId: v.id("exams"),
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    questionIds: v.array(v.id("questions")),
    enablePause: v.optional(v.boolean()),
    pauseDurationMinutes: v.optional(v.number()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Calculer le nouveau temps de completion: 83 secondes par question
    const completionTime = args.questionIds.length * 83

    // Pause is enabled if explicitly set by admin
    const enablePause = args.enablePause ?? false

    // Pause duration: default 15 minutes if enabled, max 60 minutes
    const pauseDurationMinutes = enablePause
      ? Math.min(args.pauseDurationMinutes ?? 15, 60)
      : undefined

    await ctx.db.patch(args.examId, {
      title: args.title,
      description: args.description,
      startDate: args.startDate,
      endDate: args.endDate,
      questionIds: args.questionIds,
      completionTime,
      enablePause: enablePause || undefined,
      pauseDurationMinutes,
    })

    return { success: true }
  },
})

// Supprimer un examen
export const deleteExam = mutation({
  args: { examId: v.id("exams") },
  returns: v.object({
    success: v.boolean(),
    deletedAnswers: v.boolean(),
    deletedParticipations: v.number(),
  }),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Vérifier que l'examen existe
    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw Errors.notFound("Examen")
    }

    // 1. Get all participations for this exam
    const participations = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam", (q) => q.eq("examId", args.examId))
      .take(1000)

    // 2. Delete all answers for each participation (limited per batch)
    for (const participation of participations) {
      const answers = await ctx.db
        .query("examAnswers")
        .withIndex("by_participation", (q) =>
          q.eq("participationId", participation._id),
        )
        .take(500)

      for (const answer of answers) {
        await ctx.db.delete(answer._id)
      }
    }

    // 3. Delete all participations
    for (const participation of participations) {
      await ctx.db.delete(participation._id)
    }

    // 4. Delete the exam itself
    await ctx.db.delete(args.examId)

    return {
      success: true,
      deletedAnswers: participations.length > 0, // If any participations existed
      deletedParticipations: participations.length,
    }
  },
})

// Récupérer un examen par ID avec ses questions
// Masque correctAnswer et explanation pour les non-admins
export const getExamWithQuestions = query({
  args: { examId: v.id("exams") },
  returns: v.object({
    _id: v.id("exams"),
    _creationTime: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    questionIds: v.array(v.id("questions")),
    completionTime: v.number(),
    enablePause: v.optional(v.boolean()),
    pauseDurationMinutes: v.optional(v.number()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    questions: v.array(
      v.object({
        _id: v.id("questions"),
        _creationTime: v.number(),
        question: v.string(),
        images: v.optional(
          v.array(
            v.object({
              url: v.string(),
              storagePath: v.string(),
              order: v.number(),
            }),
          ),
        ),
        options: v.array(v.string()),
        correctAnswer: v.string(),
        explanation: v.string(),
        references: v.optional(v.array(v.string())),
        objectifCMC: v.string(),
        domain: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw Errors.notFound("Examen")
    }

    const questions = await batchGetOrderedByIds(
      ctx,
      "questions",
      exam.questionIds,
    )

    const user = await getCurrentUserOrNull(ctx)
    const isUserAdmin = user?.role === "admin"

    return {
      ...exam,
      questions: questions.filter((q) => q !== null).map((q) =>
        isUserAdmin
          ? q
          : { ...q, correctAnswer: "", explanation: "" },
      ),
    }
  },
})

// Désactiver un examen
export const deactivateExam = mutation({
  args: { examId: v.id("exams") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    await ctx.db.patch(args.examId, {
      isActive: false,
    })

    return { success: true }
  },
})

// Réactiver un examen
export const reactivateExam = mutation({
  args: { examId: v.id("exams") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    await ctx.db.patch(args.examId, {
      isActive: true,
    })

    return { success: true }
  },
})

// Récupérer les examens disponibles pour l'utilisateur connecté
export const getMyAvailableExams = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("exams"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.number(),
      questionIds: v.array(v.id("questions")),
      completionTime: v.number(),
      enablePause: v.optional(v.boolean()),
      pauseDurationMinutes: v.optional(v.number()),
      isActive: v.boolean(),
      createdBy: v.id("users"),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return []
    }

    const now = Date.now()

    // Les admins peuvent voir tous les examens actifs
    if (user.role === "admin") {
      const allExams = await ctx.db
        .query("exams")
        .withIndex("by_isActive", (q) => q.eq("isActive", true))
        .take(100)

      return allExams.filter(
        (exam) => exam.startDate <= now && exam.endDate >= now,
      )
    }

    // Vérifier si l'utilisateur a un accès exam actif
    const examAccess = await ctx.db
      .query("userAccess")
      .withIndex("by_userId_accessType", (q) =>
        q.eq("userId", user._id).eq("accessType", "exam"),
      )
      .unique()

    // Si pas d'accès actif, retourner liste vide
    if (!examAccess || examAccess.expiresAt < now) {
      return []
    }

    // Retourner tous les examens actifs dans la période
    const allExams = await ctx.db
      .query("exams")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(100)

    return allExams.filter(
      (exam) => exam.startDate <= now && exam.endDate >= now,
    )
  },
})

/**
 * Start exam session using normalized tables
 * Creates a participation record instead of adding to embedded array
 */
export const startExam = mutation({
  args: {
    examId: v.id("exams"),
  },
  returns: v.object({
    participationId: v.id("examParticipations"),
    startedAt: v.number(),
    pausePhase: v.optional(
      v.union(
        v.literal("before_pause"),
        v.literal("during_pause"),
        v.literal("after_pause"),
      ),
    ),
    pauseStartedAt: v.optional(v.number()),
    pauseEndedAt: v.optional(v.number()),
    isPauseCutShort: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    // Vérifier l'accès payant aux examens (admins exemptés)
    if (user.role !== "admin") {
      const examAccess = await ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "exam"),
        )
        .unique()

      if (!examAccess || examAccess.expiresAt < Date.now()) {
        throw Errors.accessExpired("exam")
      }
    }

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw Errors.notFound("Examen")
    }

    const now = Date.now()

    // Vérifier si l'examen est disponible
    if (now < exam.startDate || now > exam.endDate) {
      throw Errors.invalidState("L'examen n'est pas disponible à cette période")
    }

    // Note: L'autorisation est vérifiée via userAccess (accès payant)
    // Les admins sont exemptés du check ci-dessus

    // Check for existing participation in V2 tables
    const existingParticipation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (existingParticipation) {
      // Si déjà complété, interdire
      if (
        existingParticipation.status === "completed" ||
        existingParticipation.status === "auto_submitted"
      ) {
        throw Errors.invalidState("Vous avez déjà passé cet examen")
      }

      // Si session en cours existe déjà, retourner les infos
      if (existingParticipation.status === "in_progress") {
        return {
          participationId: existingParticipation._id,
          startedAt: existingParticipation.startedAt!,
          pausePhase: existingParticipation.pausePhase,
          pauseStartedAt: existingParticipation.pauseStartedAt,
          pauseEndedAt: existingParticipation.pauseEndedAt,
          isPauseCutShort: existingParticipation.isPauseCutShort,
        }
      }
    }

    // Determine initial pause phase for exams with pause enabled
    const shouldInitPause = exam.enablePause === true
    const initialPausePhase = shouldInitPause
      ? ("before_pause" as const)
      : undefined

    // Create new participation record
    const participationId = await ctx.db.insert("examParticipations", {
      examId: args.examId,
      userId: user._id,
      startedAt: now,
      status: "in_progress",
      score: 0,
      completedAt: 0,
      pausePhase: initialPausePhase,
    })

    return {
      participationId,
      startedAt: now,
      pausePhase: initialPausePhase,
    }
  },
})

/**
 * Submit exam answers using normalized tables
 * Writes to examAnswers table instead of embedded array
 */
export const submitExamAnswers = mutation({
  args: {
    examId: v.id("exams"),
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedAnswer: v.string(),
        isFlagged: v.optional(v.boolean()),
      }),
    ),
    isAutoSubmit: v.optional(v.boolean()),
  },
  returns: v.object({
    score: v.number(),
    correctAnswers: v.number(),
    totalQuestions: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw Errors.notFound("Examen")
    }

    const now = Date.now()
    if (now < exam.startDate || now > exam.endDate) {
      throw Errors.invalidState("L'examen n'est pas disponible à cette période")
    }

    // Note: L'autorisation est vérifiée via userAccess plus bas
    // Les admins sont exemptés du check

    // Find participation in V2 tables
    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      throw Errors.notFound("Participation")
    }

    // Vérifier que la session est en cours
    if (
      participation.status === "completed" ||
      participation.status === "auto_submitted"
    ) {
      throw Errors.invalidState("Vous avez déjà passé cet examen")
    }

    if (participation.status !== "in_progress") {
      throw Errors.invalidState("Cette session d'examen n'est plus active")
    }

    // Re-verify exam access at submission time (admin bypass)
    // This check runs after session validation to provide appropriate error messages
    if (user.role !== "admin") {
      const examAccess = await ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "exam"),
        )
        .unique()

      if (!examAccess || examAccess.expiresAt < now) {
        throw Errors.accessExpired("exam")
      }
    }

    // Vérifier le temps écoulé côté serveur
    if (!participation.startedAt) {
      throw Errors.invalidState("L'examen n'a pas encore été démarré")
    }
    let timeElapsed = now - participation.startedAt

    // Subtract pause duration from elapsed time
    if (participation.totalPauseDurationMs) {
      timeElapsed = timeElapsed - participation.totalPauseDurationMs
    }

    const maxTimeAllowed = exam.completionTime * 1000

    // Pour les auto-submits (sessions abandonnées), on accepte toujours
    // Pour les soumissions manuelles, on garde un grace period de 5 secondes
    if (!args.isAutoSubmit) {
      const gracePeriod = 5000
      if (timeElapsed > maxTimeAllowed + gracePeriod) {
        throw Errors.invalidState(
          "Temps écoulé ! La soumission n'a pas pu être traitée à temps.",
        )
      }
    } else if (timeElapsed > maxTimeAllowed) {
      // Session abandonnée - loguer mais accepter
      const minutesLate = Math.round((timeElapsed - maxTimeAllowed) / 60000)
      console.warn(
        `Session abandonnée auto-soumise: ${minutesLate} min de retard pour exam ${args.examId}`,
      )
    }

    // PAUSE VALIDATION
    if (exam.enablePause && participation.pausePhase) {
      const totalQuestions = exam.questionIds.length
      const midpoint = Math.floor(totalQuestions / 2)

      const questionIdToIndex = new Map<string, number>()
      exam.questionIds.forEach((qId, index) => {
        questionIdToIndex.set(qId, index)
      })

      for (const answer of args.answers) {
        const questionIndex = questionIdToIndex.get(answer.questionId)
        if (questionIndex === undefined) continue

        if (
          participation.pausePhase === "before_pause" &&
          questionIndex >= midpoint
        ) {
          throw Errors.invalidState(
            `Tentative frauduleuse détectée : réponse soumise à une question verrouillée (Q${questionIndex + 1})`,
          )
        }

        if (participation.pausePhase === "during_pause") {
          throw Errors.invalidState(
            "Soumission non autorisée pendant la pause. Veuillez reprendre l'examen.",
          )
        }
      }
    }

    // Calculer le score — toujours vérifier côté serveur
    const questionMap = await batchGetByIds(ctx, "questions", exam.questionIds)

    const answersWithCorrectness = args.answers.map((answer) => {
      const question = questionMap.get(answer.questionId)
      const isCorrect = question?.correctAnswer === answer.selectedAnswer
      return {
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
        isFlagged: answer.isFlagged ?? false,
      }
    })

    const score = answersWithCorrectness.filter((a) => a.isCorrect).length
    const totalQuestions = exam.questionIds.length
    const percentage = Math.round((score / totalQuestions) * 100)

    // Save answers to examAnswers table (parallel writes)
    await Promise.all(
      answersWithCorrectness.map((answer) =>
        ctx.db.insert("examAnswers", {
          participationId: participation._id,
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect: answer.isCorrect,
          isFlagged: answer.isFlagged,
        }),
      ),
    )

    // Update participation status
    const finalStatus = args.isAutoSubmit ? "auto_submitted" : "completed"

    await ctx.db.patch(participation._id, {
      score: percentage,
      completedAt: now,
      status: finalStatus,
    })

    return {
      score: percentage,
      correctAnswers: score,
      totalQuestions,
    }
  },
})

/**
 * Get exam session using normalized tables
 */
export const getExamSession = query({
  args: {
    examId: v.id("exams"),
  },
  returns: v.union(
    v.null(),
    v.object({
      participationId: v.id("examParticipations"),
      status: v.optional(
        v.union(
          v.literal("in_progress"),
          v.literal("completed"),
          v.literal("auto_submitted"),
        ),
      ),
      startedAt: v.optional(v.number()),
      completedAt: v.number(),
      pausePhase: v.optional(
        v.union(
          v.literal("before_pause"),
          v.literal("during_pause"),
          v.literal("after_pause"),
        ),
      ),
      pauseStartedAt: v.optional(v.number()),
      pauseEndedAt: v.optional(v.number()),
      isPauseCutShort: v.optional(v.boolean()),
      totalPauseDurationMs: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return null
    }

    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      return null
    }

    return {
      participationId: participation._id,
      status: participation.status,
      startedAt: participation.startedAt,
      completedAt: participation.completedAt,
      pausePhase: participation.pausePhase,
      pauseStartedAt: participation.pauseStartedAt,
      pauseEndedAt: participation.pauseEndedAt,
      isPauseCutShort: participation.isPauseCutShort,
      totalPauseDurationMs: participation.totalPauseDurationMs,
    }
  },
})

/**
 * Get participant exam results using normalized tables
 */
export const getParticipantExamResults = query({
  args: {
    examId: v.id("exams"),
    userId: v.id("users"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrNull(ctx)
    if (!currentUser) {
      return null
    }

    const isAdmin = currentUser.role === "admin"
    const isOwnResult = currentUser._id === args.userId

    if (!isAdmin && !isOwnResult) {
      return null
    }

    // Fetch exam, participation, and user in parallel
    const [exam, participation, participantUser] = await Promise.all([
      ctx.db.get(args.examId),
      ctx.db
        .query("examParticipations")
        .withIndex("by_exam_user", (q) =>
          q.eq("examId", args.examId).eq("userId", args.userId),
        )
        .unique(),
      ctx.db.get(args.userId),
    ])

    if (!exam) {
      return null
    }

    // Non-admins can only see results after exam ends
    if (!isAdmin) {
      const now = Date.now()
      if (now < exam.endDate) {
        return null
      }
    }

    if (!participation) {
      if (isAdmin) {
        return {
          error: "NO_PARTICIPATION",
          message: participantUser
            ? "Ce participant n'a pas encore commencé cet examen"
            : "Utilisateur introuvable",
          exam: {
            _id: exam._id,
            title: exam.title,
            description: exam.description,
            startDate: exam.startDate,
            endDate: exam.endDate,
            completionTime: exam.completionTime,
          },
          participantUser: participantUser
            ? {
                _id: participantUser._id,
                name: participantUser.name,
                username: participantUser.username,
                email: participantUser.email,
                image: participantUser.image,
              }
            : null,
        }
      }
      return null
    }

    if (
      participation.status !== "completed" &&
      participation.status !== "auto_submitted"
    ) {
      if (isAdmin) {
        return {
          error: "NOT_COMPLETED",
          message: "Ce participant n'a pas encore terminé l'examen",
          status: participation.status,
          exam: {
            _id: exam._id,
            title: exam.title,
            description: exam.description,
            startDate: exam.startDate,
            endDate: exam.endDate,
            completionTime: exam.completionTime,
          },
          participantUser: participantUser
            ? {
                _id: participantUser._id,
                name: participantUser.name,
                username: participantUser.username,
                email: participantUser.email,
                image: participantUser.image,
              }
            : null,
        }
      }
      return null
    }

    // Get questions using batch fetch
    const questions = await batchGetOrderedByIds(
      ctx,
      "questions",
      exam.questionIds,
    )

    // Get answers from examAnswers table (indexed query)
    // Limit set to 500 to support exams with up to 500 questions
    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) =>
        q.eq("participationId", participation._id),
      )
      .take(500)

    return {
      exam: {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        startDate: exam.startDate,
        endDate: exam.endDate,
        completionTime: exam.completionTime,
      },
      participant: {
        participationId: participation._id,
        userId: participation.userId,
        score: participation.score,
        completedAt: participation.completedAt,
        startedAt: participation.startedAt,
        answers: answers.map((a) => ({
          questionId: a.questionId,
          selectedAnswer: a.selectedAnswer,
          isCorrect: a.isCorrect,
        })),
      },
      participantUser: participantUser
        ? {
            _id: participantUser._id,
            name: participantUser.name,
            username: participantUser.username,
            email: participantUser.email,
            image: participantUser.image,
          }
        : null,
      questions: questions.filter(Boolean),
    }
  },
})

/**
 * Get all exams with participant count from normalized tables
 * Optimized: fetches all participations in one query to avoid N+1
 */
export const getAllExams = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("exams"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.number(),
      questionIds: v.array(v.id("questions")),
      completionTime: v.number(),
      enablePause: v.optional(v.boolean()),
      pauseDurationMinutes: v.optional(v.number()),
      isActive: v.boolean(),
      createdBy: v.id("users"),
      participantCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    // Limit to 100 exams for performance
    const exams = await ctx.db.query("exams").order("desc").take(100)

    // Fetch participations limited for performance
    const allParticipations = await ctx.db
      .query("examParticipations")
      .take(2000)

    // Create a count map by examId
    const participationCountMap = new Map<string, number>()
    for (const p of allParticipations) {
      const count = participationCountMap.get(p.examId) ?? 0
      participationCountMap.set(p.examId, count + 1)
    }

    // Map exams with their participation counts
    const examsWithParticipantCount = exams.map((exam) => ({
      ...exam,
      participantCount: participationCountMap.get(exam._id) ?? 0,
    }))

    return examsWithParticipantCount
  },
})

// ============================================
// CRON JOBS - Internal mutations
// ============================================

/**
 * Ferme automatiquement les participations in_progress des examens expirés
 * Appelé par le cron job toutes les heures
 *
 * Optimisation: on commence par les participations in_progress (peu nombreuses)
 * puis on vérifie si leur examen est expiré, au lieu de scanner tous les examens expirés
 */
export const closeExpiredParticipations = internalMutation({
  args: {},
  returns: v.object({
    closedCount: v.number(),
    processedCount: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now()

    // 1. Trouver toutes les participations in_progress (utilise l'index by_status)
    const inProgressParticipations = await ctx.db
      .query("examParticipations")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .take(500)

    if (inProgressParticipations.length === 0) {
      return { closedCount: 0, processedCount: 0 }
    }

    // 2. Récupérer les examens concernés en une seule requête batch
    const examIds = [...new Set(inProgressParticipations.map((p) => p.examId))]
    const examMap = await batchGetByIds(ctx, "exams", examIds)

    // 3. Filtrer les participations dont l'examen est expiré
    const expiredParticipations = inProgressParticipations.filter((p) => {
      const exam = examMap.get(p.examId)
      return exam && exam.endDate < now
    })

    if (expiredParticipations.length === 0) {
      return { closedCount: 0, processedCount: inProgressParticipations.length }
    }

    // 4. Batch fetch toutes les réponses en parallèle (évite N+1)
    const allAnswersArrays = await Promise.all(
      expiredParticipations.map((p) =>
        ctx.db
          .query("examAnswers")
          .withIndex("by_participation", (q) => q.eq("participationId", p._id))
          .take(500),
      ),
    )

    // Build a map of participationId -> answers
    const answersMap = new Map<string, typeof allAnswersArrays[0]>()
    for (let i = 0; i < expiredParticipations.length; i++) {
      answersMap.set(expiredParticipations[i]._id, allAnswersArrays[i])
    }

    let closedCount = 0

    // 5. Pour chaque participation expirée, calculer le score et fermer
    for (const participation of expiredParticipations) {
      const exam = examMap.get(participation.examId)
      if (!exam) continue

      const existingAnswers = answersMap.get(participation._id) ?? []
      const correctAnswers = existingAnswers.filter((a) => a.isCorrect).length
      const totalQuestions = exam.questionIds.length
      const score =
        totalQuestions > 0
          ? Math.round((correctAnswers / totalQuestions) * 100)
          : 0

      // Fermer la participation
      await ctx.db.patch(participation._id, {
        status: "auto_submitted",
        score,
        completedAt: now,
      })

      closedCount++
    }

    if (closedCount > 0) {
      console.log(
        `[Cron] Fermé ${closedCount} participation(s) expirée(s) sur ${inProgressParticipations.length} in_progress`,
      )
    }

    return { closedCount, processedCount: inProgressParticipations.length }
  },
})
