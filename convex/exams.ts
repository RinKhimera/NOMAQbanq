import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import {
  getAdminUserOrThrow,
  getCurrentUserOrNull,
  getCurrentUserOrThrow,
} from "./lib/auth"

// Créer un nouvel examen
export const createExam = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    questionIds: v.array(v.id("questions")),
    allowedParticipants: v.array(v.id("users")),
    enablePause: v.optional(v.boolean()),
    pauseDurationMinutes: v.optional(v.number()),
  },
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
      allowedParticipants: args.allowedParticipants,
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
    allowedParticipants: v.array(v.id("users")),
    enablePause: v.optional(v.boolean()),
    pauseDurationMinutes: v.optional(v.number()),
  },
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
      allowedParticipants: args.allowedParticipants,
      enablePause: enablePause || undefined,
      pauseDurationMinutes,
    })

    return { success: true }
  },
})

// Supprimer un examen
export const deleteExam = mutation({
  args: { examId: v.id("exams") },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Vérifier que l'examen existe
    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
    }

    // 1. Get all participations for this exam
    const participations = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam", (q) => q.eq("examId", args.examId))
      .collect()

    // 2. Delete all answers for each participation
    for (const participation of participations) {
      const answers = await ctx.db
        .query("examAnswers")
        .withIndex("by_participation", (q) =>
          q.eq("participationId", participation._id),
        )
        .collect()

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
export const getExamWithQuestions = query({
  args: { examId: v.id("exams") },
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
    }

    const questions = await Promise.all(
      exam.questionIds.map(async (questionId) => {
        return await ctx.db.get(questionId)
      }),
    )

    return {
      ...exam,
      questions: questions.filter(Boolean),
    }
  },
})

// Désactiver un examen
export const deactivateExam = mutation({
  args: { examId: v.id("exams") },
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
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return []
    }

    const now = Date.now()
    const allExams = await ctx.db
      .query("exams")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    // Filtrer les examens disponibles pour l'utilisateur
    const availableExams = allExams.filter((exam) => {
      const isActive = exam.startDate <= now && exam.endDate >= now

      // Les admins/superusers peuvent voir tous les examens actifs
      if (user.role === "admin") {
        return isActive
      }

      // Les utilisateurs normaux doivent être dans allowedParticipants
      const isAllowed = exam.allowedParticipants.includes(user._id)
      return isAllowed && isActive
    })

    return availableExams
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
        throw new Error(
          "Accès aux examens requis. Veuillez souscrire un abonnement.",
        )
      }
    }

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
    }

    const now = Date.now()

    // Vérifier si l'examen est disponible
    if (now < exam.startDate || now > exam.endDate) {
      throw new Error("L'examen n'est pas disponible à cette période")
    }

    // Vérifier l'autorisation
    if (user.role !== "admin" && !exam.allowedParticipants.includes(user._id)) {
      throw new Error("Vous n'êtes pas autorisé à passer cet examen")
    }

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
        throw new Error("Vous avez déjà passé cet examen")
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
    correctAnswers: v.optional(v.record(v.string(), v.string())),
    isAutoSubmit: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
    }

    const now = Date.now()
    if (now < exam.startDate || now > exam.endDate) {
      throw new Error("L'examen n'est pas disponible à cette période")
    }

    // Vérifier si l'utilisateur est autorisé à passer cet examen
    if (user.role !== "admin" && !exam.allowedParticipants.includes(user._id)) {
      throw new Error("Vous n'êtes pas autorisé à passer cet examen")
    }

    // Find participation in V2 tables
    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      throw new Error(
        "Session d'examen non trouvée. Vous devez d'abord démarrer l'examen.",
      )
    }

    // Vérifier que la session est en cours
    if (
      participation.status === "completed" ||
      participation.status === "auto_submitted"
    ) {
      throw new Error("Vous avez déjà passé cet examen")
    }

    if (participation.status !== "in_progress") {
      throw new Error("Cette session d'examen n'est plus active")
    }

    // Vérifier le temps écoulé côté serveur
    const startedAt = participation.startedAt || now
    let timeElapsed = now - startedAt

    // Subtract pause duration from elapsed time
    if (participation.totalPauseDurationMs) {
      timeElapsed = timeElapsed - participation.totalPauseDurationMs
    }

    const maxTimeAllowed = exam.completionTime * 1000
    const gracePeriod = args.isAutoSubmit ? 30000 : 5000
    const maxTimeWithGrace = maxTimeAllowed + gracePeriod

    if (timeElapsed > maxTimeWithGrace) {
      throw new Error(
        "Temps écoulé ! La soumission n'a pas pu être traitée à temps.",
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
          throw new Error(
            `Tentative frauduleuse détectée : réponse soumise à une question verrouillée (Q${questionIndex + 1})`,
          )
        }

        if (participation.pausePhase === "during_pause") {
          throw new Error(
            "Soumission non autorisée pendant la pause. Veuillez reprendre l'examen.",
          )
        }
      }
    }

    // Calculer le score
    let answersWithCorrectness

    if (args.correctAnswers && Object.keys(args.correctAnswers).length > 0) {
      answersWithCorrectness = args.answers.map((answer) => {
        const correctAnswer = args.correctAnswers?.[answer.questionId]
        const isCorrect = correctAnswer === answer.selectedAnswer
        return {
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect,
          isFlagged: answer.isFlagged ?? false,
        }
      })
    } else {
      // Fallback: read questions from DB
      const questions = await Promise.all(
        exam.questionIds.map(async (questionId) => {
          return await ctx.db.get(questionId)
        }),
      )

      answersWithCorrectness = args.answers.map((answer) => {
        const question = questions.find((q) => q?._id === answer.questionId)
        const isCorrect = question?.correctAnswer === answer.selectedAnswer
        return {
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect,
          isFlagged: answer.isFlagged ?? false,
        }
      })
    }

    const score = answersWithCorrectness.filter((a) => a.isCorrect).length
    const totalQuestions = exam.questionIds.length
    const percentage = Math.round((score / totalQuestions) * 100)

    // Save answers to examAnswers table (individual writes)
    for (const answer of answersWithCorrectness) {
      await ctx.db.insert("examAnswers", {
        participationId: participation._id,
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect: answer.isCorrect,
        isFlagged: answer.isFlagged,
      })
    }

    // Update participation status
    await ctx.db.patch(participation._id, {
      score: percentage,
      completedAt: now,
      status: args.isAutoSubmit ? "auto_submitted" : "completed",
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

    const exam = await ctx.db.get(args.examId)
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

    // Find participation in V2 tables
    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", args.userId),
      )
      .unique()

    const participantUser = await ctx.db.get(args.userId)

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

    // Get questions
    const questions = await Promise.all(
      exam.questionIds.map(async (questionId) => {
        return await ctx.db.get(questionId)
      }),
    )

    // Get answers from examAnswers table (indexed query)
    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) =>
        q.eq("participationId", participation._id),
      )
      .collect()

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
 * Start pause using normalized tables
 */
export const startPause = mutation({
  args: {
    examId: v.id("exams"),
    manualTrigger: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
    }

    if (!exam.enablePause) {
      throw new Error("La pause n'est pas activée pour cet examen")
    }

    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      throw new Error("Session d'examen non trouvée")
    }

    if (participation.status !== "in_progress") {
      throw new Error("L'examen n'est pas en cours")
    }

    if (participation.pausePhase !== "before_pause") {
      throw new Error("La pause ne peut être démarrée qu'une seule fois")
    }

    const now = Date.now()

    if (!args.manualTrigger) {
      const startedAt = participation.startedAt || now
      const elapsedTime = now - startedAt
      const totalTime = exam.completionTime * 1000
      const halfTime = totalTime / 2

      if (elapsedTime < halfTime - 10000) {
        throw new Error(
          "La pause automatique ne peut être déclenchée qu'à la mi-parcours du chronomètre",
        )
      }
    }

    await ctx.db.patch(participation._id, {
      pausePhase: "during_pause",
      pauseStartedAt: now,
    })

    return {
      pauseStartedAt: now,
      pauseDurationMinutes: exam.pauseDurationMinutes || 15,
    }
  },
})

/**
 * Resume from pause using normalized tables
 */
export const resumeFromPause = mutation({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
    }

    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      throw new Error("Session d'examen non trouvée")
    }

    if (participation.status !== "in_progress") {
      throw new Error("L'examen n'est pas en cours")
    }

    if (participation.pausePhase !== "during_pause") {
      throw new Error("Vous n'êtes pas actuellement en pause")
    }

    const now = Date.now()
    const pauseStartedAt = participation.pauseStartedAt || now
    const pauseDurationMs = (exam.pauseDurationMinutes || 15) * 60 * 1000
    const pauseEndTime = pauseStartedAt + pauseDurationMs

    const isPauseCutShort = now < pauseEndTime
    const actualPauseDurationMs = now - pauseStartedAt

    await ctx.db.patch(participation._id, {
      pausePhase: "after_pause",
      pauseEndedAt: now,
      isPauseCutShort,
      totalPauseDurationMs: actualPauseDurationMs,
    })

    return {
      pauseEndedAt: now,
      isPauseCutShort,
      totalPauseDurationMs: actualPauseDurationMs,
    }
  },
})

/**
 * Get pause status using normalized tables
 */
export const getPauseStatus = query({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return null
    }

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
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

    const totalQuestions = exam.questionIds.length
    const midpoint = Math.floor(totalQuestions / 2)

    return {
      enablePause: exam.enablePause ?? false,
      pauseDurationMinutes: exam.pauseDurationMinutes ?? 15,
      pausePhase: participation.pausePhase,
      pauseStartedAt: participation.pauseStartedAt,
      pauseEndedAt: participation.pauseEndedAt,
      isPauseCutShort: participation.isPauseCutShort,
      totalQuestions,
      midpoint,
      questionsBeforePause: midpoint,
      questionsAfterPause: totalQuestions - midpoint,
    }
  },
})

/**
 * Validate question access using normalized tables
 */
export const validateQuestionAccess = query({
  args: {
    examId: v.id("exams"),
    questionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return { allowed: false, reason: "Non authentifié" }
    }

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      return { allowed: false, reason: "Examen non trouvé" }
    }

    if (!exam.enablePause) {
      return { allowed: true }
    }

    const participation = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) =>
        q.eq("examId", args.examId).eq("userId", user._id),
      )
      .unique()

    if (!participation) {
      return { allowed: false, reason: "Session non trouvée" }
    }

    const totalQuestions = exam.questionIds.length
    const midpoint = Math.floor(totalQuestions / 2)
    const questionIndex = args.questionIndex

    switch (participation.pausePhase) {
      case "before_pause":
        if (questionIndex >= midpoint) {
          return {
            allowed: false,
            reason:
              "Cette question sera déverrouillée après la pause obligatoire",
          }
        }
        return { allowed: true }

      case "during_pause":
        return {
          allowed: false,
          reason: "Questions verrouillées pendant la pause",
        }

      case "after_pause":
        return { allowed: true }

      default:
        return { allowed: true }
    }
  },
})

/**
 * Get exam leaderboard using normalized tables
 * Admin can always view; others can only view after exam ends and if they participated
 */
export const getExamLeaderboard = query({
  args: { examId: v.id("exams") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrNull(ctx)

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
    }

    // Authorization check
    if (currentUser?.role !== "admin") {
      const now = Date.now()
      // During exam, no leaderboard access for non-admins
      if (now < exam.endDate) {
        return []
      }

      // After exam ends: only allowed participants or those who participated can view
      if (currentUser) {
        const isAllowed = exam.allowedParticipants.includes(currentUser._id)
        if (!isAllowed) {
          const hasParticipated = await ctx.db
            .query("examParticipations")
            .withIndex("by_exam_user", (q) =>
              q.eq("examId", args.examId).eq("userId", currentUser._id),
            )
            .unique()
          if (!hasParticipated) {
            return []
          }
        }
      } else {
        return []
      }
    }

    // Get all participations for this exam
    const participations = await ctx.db
      .query("examParticipations")
      .withIndex("by_exam", (q) => q.eq("examId", args.examId))
      .collect()

    // Filter completed participations and get user info
    const leaderboard = await Promise.all(
      participations
        .filter(
          (p) => p.status === "completed" || p.status === "auto_submitted",
        )
        .map(async (participation) => {
          const user = await ctx.db.get(participation.userId)
          return {
            participationId: participation._id,
            user,
            score: participation.score,
            completedAt: participation.completedAt,
          }
        }),
    )

    // Sort by score descending
    return leaderboard
      .filter((entry) => entry.user !== null)
      .sort((a, b) => b.score - a.score)
  },
})

/**
 * Get all exams with participant count from normalized tables
 * Optimized: fetches all participations in one query to avoid N+1
 */
export const getAllExams = query({
  handler: async (ctx) => {
    const exams = await ctx.db.query("exams").order("desc").collect()

    // Fetch all participations in one query (avoids N+1 problem)
    const allParticipations = await ctx.db
      .query("examParticipations")
      .collect()

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

/**
 * Get user's dashboard stats using normalized tables
 */
export const getMyDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return null
    }

    // Get all exams user has access to
    const allExams = await ctx.db.query("exams").collect()
    const myExams = allExams.filter((exam) =>
      exam.allowedParticipants.includes(user._id),
    )

    // Get user's participations from V2 tables
    const myParticipations = await ctx.db
      .query("examParticipations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    const completedParticipations = myParticipations.filter(
      (p) => p.status === "completed" || p.status === "auto_submitted",
    )

    // Calculate average score
    let totalScore = 0
    const examCount = completedParticipations.length

    completedParticipations.forEach((p) => {
      totalScore += p.score
    })

    const averageScore = examCount > 0 ? Math.round(totalScore / examCount) : 0

    // Count learning bank questions
    const learningBankQuestions = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    return {
      availableExamsCount: myExams.length,
      completedExamsCount: examCount,
      averageScore,
      learningBankQuestionsCount: learningBankQuestions.length,
    }
  },
})

/**
 * Get user's recent exams using normalized tables
 */
export const getMyRecentExams = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return []
    }

    // Get user's participations
    const myParticipations = await ctx.db
      .query("examParticipations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    // Get all exams user has access to
    const allExams = await ctx.db.query("exams").collect()

    // Create participation lookup map
    const participationMap = new Map(myParticipations.map((p) => [p.examId, p]))

    // Filter and map user's exams
    const userExams = allExams
      .filter((exam) => exam.allowedParticipants.includes(user._id))
      .map((exam) => {
        const participation = participationMap.get(exam._id)
        const isCompleted =
          participation?.status === "completed" ||
          participation?.status === "auto_submitted"
        return {
          _id: exam._id,
          title: exam.title,
          startDate: exam.startDate,
          endDate: exam.endDate,
          isCompleted,
          score: isCompleted ? (participation?.score ?? null) : null,
          completedAt: participation?.completedAt ?? null,
        }
      })
      .sort((a, b) => {
        if (a.completedAt && b.completedAt) {
          return b.completedAt - a.completedAt
        }
        if (a.completedAt && !b.completedAt) return -1
        if (!a.completedAt && b.completedAt) return 1
        return b.startDate - a.startDate
      })
      .slice(0, 5)

    return userExams
  },
})

/**
 * Get all exams with current user's participation status
 * Used by mock-exam page to show exam list with "already taken" status
 */
export const getAllExamsWithUserParticipation = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    const exams = await ctx.db.query("exams").order("desc").collect()

    if (!user) {
      return exams.map((exam) => ({
        ...exam,
        userHasTaken: false,
        userParticipation: null,
      }))
    }

    // Get user's participations in a single query
    const userParticipations = await ctx.db
      .query("examParticipations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    // Create a map for O(1) lookup
    const participationMap = new Map(
      userParticipations.map((p) => [p.examId, p]),
    )

    return exams.map((exam) => {
      const participation = participationMap.get(exam._id)

      return {
        ...exam,
        userHasTaken:
          participation?.status === "completed" ||
          participation?.status === "auto_submitted",
        userParticipation: participation
          ? {
              status: participation.status,
              score: participation.score,
              completedAt: participation.completedAt,
            }
          : null,
      }
    })
  },
})
