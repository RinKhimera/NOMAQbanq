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
      participants: [],
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

    // Supprimer l'examen
    await ctx.db.delete(args.examId)

    return { success: true }
  },
})

// Récupérer tous les examens
export const getAllExams = query({
  handler: async (ctx) => {
    return await ctx.db.query("exams").order("desc").collect()
  },
})

// Récupérer metadata des examens
export const getAllExamsMetadata = query({
  handler: async (ctx) => {
    const exams = await ctx.db.query("exams").order("desc").collect()

    // Retourner seulement les métadonnées essentielles
    return exams.map((exam) => ({
      _id: exam._id,
      _creationTime: exam._creationTime,
      title: exam.title,
      description: exam.description,
      startDate: exam.startDate,
      endDate: exam.endDate,
      completionTime: exam.completionTime,
      isActive: exam.isActive,
      questionCount: exam.questionIds.length,
      participantCount: exam.participants.length,
      // Ne pas inclure les arrays questionIds et participants
    }))
  },
})

// Récupérer les examens actifs pour les utilisateurs
export const getActiveExams = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return []
    }

    const now = Date.now()
    const exams = await ctx.db
      .query("exams")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .filter((q) =>
        q.and(q.lte(q.field("startDate"), now), q.gte(q.field("endDate"), now)),
      )
      .collect()

    // Filtrer les examens selon les permissions
    // Les admins peuvent voir tous les examens, les utilisateurs seulement ceux où ils sont autorisés
    if (user.role === "admin") {
      return exams
    }

    return exams.filter((exam) => exam.allowedParticipants.includes(user._id))
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

// Soumettre les réponses d'un examen
export const submitExamAnswers = mutation({
  args: {
    examId: v.id("exams"),
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedAnswer: v.string(),
      }),
    ),
    // Accepter les réponses correctes depuis le frontend pour éviter de relire les questions
    correctAnswers: v.optional(
      v.record(v.string(), v.string()), // { questionId: correctAnswer }
    ),
    // Flag pour indiquer si c'est une soumission automatique (temps écoulé)
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
    // Les admins peuvent toujours passer les examens
    if (user.role !== "admin" && !exam.allowedParticipants.includes(user._id)) {
      throw new Error("Vous n'êtes pas autorisé à passer cet examen")
    }

    // Trouver la participation de l'utilisateur
    const participantIndex = exam.participants.findIndex(
      (p) => p.userId === user._id,
    )

    if (participantIndex === -1) {
      throw new Error(
        "Session d'examen non trouvée. Vous devez d'abord démarrer l'examen.",
      )
    }

    const participant = exam.participants[participantIndex]

    // Vérifier que la session est en cours
    if (participant.status === "completed") {
      throw new Error("Vous avez déjà passé cet examen")
    }

    if (participant.status !== "in_progress") {
      throw new Error("Cette session d'examen n'est plus active")
    }

    // Vérifier le temps écoulé côté serveur
    const startedAt = participant.startedAt || now
    let timeElapsed = now - startedAt

    // Subtract pause duration from elapsed time (timer was frozen during pause)
    if (participant.totalPauseDurationMs) {
      timeElapsed = timeElapsed - participant.totalPauseDurationMs
    }

    const maxTimeAllowed = exam.completionTime * 1000

    // Pour soumission automatique : accepter jusqu'à 30 secondes après l'expiration (marge réseau/traitement)
    // Pour soumission manuelle : accepter jusqu'à 5 secondes après l'expiration (marge latence réseau)
    const gracePeriod = args.isAutoSubmit ? 30000 : 5000
    const maxTimeWithGrace = maxTimeAllowed + gracePeriod

    if (timeElapsed > maxTimeWithGrace) {
      // Si le temps est vraiment trop écoulé, rejeter la soumission
      throw new Error(
        "Temps écoulé ! La soumission n'a pas pu être traitée à temps.",
      )
    }

    // PAUSE VALIDATION: Verify submitted answers respect pause rules
    if (exam.enablePause && participant.pausePhase) {
      const totalQuestions = exam.questionIds.length
      const midpoint = Math.floor(totalQuestions / 2)

      // Create a map of questionId to index for validation
      const questionIdToIndex = new Map<string, number>()
      exam.questionIds.forEach((qId, index) => {
        questionIdToIndex.set(qId, index)
      })

      // Validate each submitted answer
      for (const answer of args.answers) {
        const questionIndex = questionIdToIndex.get(answer.questionId)
        if (questionIndex === undefined) continue

        // During "before_pause" phase, reject answers to second half questions
        if (
          participant.pausePhase === "before_pause" &&
          questionIndex >= midpoint
        ) {
          throw new Error(
            `Tentative frauduleuse détectée : réponse soumise à une question verrouillée (Q${questionIndex + 1})`,
          )
        }

        // During "during_pause" phase, reject all new answers
        if (participant.pausePhase === "during_pause") {
          throw new Error(
            "Soumission non autorisée pendant la pause. Veuillez reprendre l'examen.",
          )
        }
      }
    }

    // Calculer le score
    let answersWithCorrectness

    if (args.correctAnswers && Object.keys(args.correctAnswers).length > 0) {
      // Utiliser les correctAnswers passées depuis le frontend (évite 200 DB reads!)
      answersWithCorrectness = args.answers.map((answer) => {
        const correctAnswer = args.correctAnswers?.[answer.questionId]
        const isCorrect = correctAnswer === answer.selectedAnswer
        return {
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect,
        }
      })
    } else {
      // Fallback : lire les questions depuis la DB (méthode ancienne)
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
        }
      })
    }

    const score = answersWithCorrectness.filter((a) => a.isCorrect).length
    const totalQuestions = exam.questionIds.length
    const percentage = Math.round((score / totalQuestions) * 100)

    // Mettre à jour le participant existant
    const updatedParticipants = [...exam.participants]
    updatedParticipants[participantIndex] = {
      ...participant,
      score: percentage,
      completedAt: now,
      status: "completed",
      answers: answersWithCorrectness,
      // Garder inProgressAnswers pour référence
    }

    // Trier les participants par score décroissant
    updatedParticipants.sort((a, b) => b.score - a.score)

    await ctx.db.patch(args.examId, {
      participants: updatedParticipants,
    })

    return {
      score: percentage,
      correctAnswers: score,
      totalQuestions,
    }
  },
})

// Récupérer le classement d'un examen
export const getExamLeaderboard = query({
  args: { examId: v.id("exams") },
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
    }

    const leaderboard = await Promise.all(
      exam.participants.map(async (participant) => {
        const user = await ctx.db.get(participant.userId)
        return {
          user,
          score: participant.score,
          completedAt: participant.completedAt,
        }
      }),
    )

    return leaderboard.filter((entry) => entry.user !== null)
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

// Récupérer les statistiques du dashboard de l'utilisateur
export const getMyDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return null
    }

    // Récupérer tous les examens de l'utilisateur
    const allExams = await ctx.db.query("exams").collect()

    // Examens auxquels l'utilisateur a accès
    const myExams = allExams.filter((exam) =>
      exam.allowedParticipants.includes(user._id),
    )

    // Examens complétés
    const completedExams = myExams.filter((exam) =>
      exam.participants.some((p) => p.userId === user._id),
    )

    // Calculer le score moyen
    let totalScore = 0
    let examCount = 0

    completedExams.forEach((exam) => {
      const participation = exam.participants.find((p) => p.userId === user._id)
      if (participation) {
        totalScore += participation.score
        examCount++
      }
    })

    const averageScore = examCount > 0 ? Math.round(totalScore / examCount) : 0

    // Compter les questions dans la Learning Bank
    const learningBankQuestions = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    return {
      availableExamsCount: myExams.length,
      completedExamsCount: completedExams.length,
      averageScore,
      learningBankQuestionsCount: learningBankQuestions.length,
    }
  },
})

// Récupérer les derniers examens complétés par l'utilisateur
export const getMyRecentExams = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return []
    }

    const allExams = await ctx.db.query("exams").collect()

    // Filtrer et mapper les examens de l'utilisateur
    const userExams = allExams
      .filter((exam) => exam.allowedParticipants.includes(user._id))
      .map((exam) => {
        const participation = exam.participants.find(
          (p) => p.userId === user._id,
        )
        return {
          _id: exam._id,
          title: exam.title,
          startDate: exam.startDate,
          endDate: exam.endDate,
          isCompleted: !!participation,
          score: participation?.score ?? null,
          completedAt: participation?.completedAt ?? null,
        }
      })
      .sort((a, b) => {
        // Trier par date de complétion (les plus récents en premier)
        if (a.completedAt && b.completedAt) {
          return b.completedAt - a.completedAt
        }
        // Les examens non complétés en dernier
        if (a.completedAt && !b.completedAt) return -1
        if (!a.completedAt && b.completedAt) return 1
        // Sinon trier par date de début
        return b.startDate - a.startDate
      })
      .slice(0, 5) // Prendre les 5 derniers

    return userExams
  },
})

// Démarrer une session d'examen
export const startExam = mutation({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

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

    // Vérifier si l'utilisateur a déjà une session en cours ou complétée
    const existingParticipation = exam.participants.find(
      (p) => p.userId === user._id,
    )

    if (existingParticipation) {
      // Si déjà complété, interdire
      if (existingParticipation.status === "completed") {
        throw new Error("Vous avez déjà passé cet examen")
      }

      // Si session en cours existe déjà, retourner les infos
      if (existingParticipation.status === "in_progress") {
        return {
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

    // Créer une nouvelle session
    const newParticipant = {
      userId: user._id,
      startedAt: now,
      status: "in_progress" as const,
      score: 0,
      completedAt: 0,
      answers: [],
      // Initialize pause phase if pause is enabled
      ...(shouldInitPause && { pausePhase: initialPausePhase }),
    }

    const updatedParticipants = [...exam.participants, newParticipant]

    await ctx.db.patch(args.examId, {
      participants: updatedParticipants,
    })

    return {
      startedAt: now,
      pausePhase: initialPausePhase,
    }
  },
})
// Récupérer la session en cours d'un utilisateur
export const getExamSession = query({
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

    const participation = exam.participants.find((p) => p.userId === user._id)

    if (!participation) {
      return null
    }

    return {
      status: participation.status,
      startedAt: participation.startedAt,
      completedAt: participation.completedAt,
      // Pause-related fields
      pausePhase: participation.pausePhase,
      pauseStartedAt: participation.pauseStartedAt,
      pauseEndedAt: participation.pauseEndedAt,
      isPauseCutShort: participation.isPauseCutShort,
      totalPauseDurationMs: participation.totalPauseDurationMs,
    }
  },
})

// Récupérer les résultats d'un participant pour un examen
// Admins peuvent voir tous les résultats, utilisateurs seulement leurs propres résultats
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

    // Vérifier les permissions: admin ou propre résultat
    const isAdmin = currentUser.role === "admin"
    const isOwnResult = currentUser._id === args.userId

    if (!isAdmin && !isOwnResult) {
      return null // Accès non autorisé
    }

    // Récupérer l'examen
    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      return null
    }

    // Les non-admins ne peuvent voir les résultats qu'après la fin de l'examen
    if (!isAdmin) {
      const now = Date.now()
      if (now < exam.endDate) {
        return null // L'examen n'est pas encore terminé
      }
    }

    // Trouver le participant
    const participant = exam.participants.find((p) => p.userId === args.userId)

    // Pour les admins, retourner des informations sur l'état même si pas de résultats
    if (!participant) {
      if (isAdmin) {
        // Vérifier si l'utilisateur existe
        const participantUser = await ctx.db.get(args.userId)
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

    if (participant.status !== "completed") {
      if (isAdmin) {
        const participantUser = await ctx.db.get(args.userId)
        return {
          error: "NOT_COMPLETED",
          message: "Ce participant n'a pas encore terminé l'examen",
          status: participant.status,
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

    // Récupérer les questions
    const questions = await Promise.all(
      exam.questionIds.map(async (questionId) => {
        return await ctx.db.get(questionId)
      }),
    )

    // Récupérer les informations du participant (user)
    const participantUser = await ctx.db.get(args.userId)

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
        userId: participant.userId,
        score: participant.score,
        completedAt: participant.completedAt,
        startedAt: participant.startedAt,
        answers: participant.answers,
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

// ==========================================
// PAUSE FUNCTIONALITY
// ==========================================

/**
 * Start the mandatory pause
 * Can be triggered manually by user or automatically when timer reaches 50%
 * Users can only take one pause per exam
 */
export const startPause = mutation({
  args: {
    examId: v.id("exams"),
    manualTrigger: v.optional(v.boolean()), // Allow manual early trigger
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
    }

    // Verify pause is enabled for this exam
    if (!exam.enablePause) {
      throw new Error("La pause n'est pas activée pour cet examen")
    }

    const participantIndex = exam.participants.findIndex(
      (p) => p.userId === user._id,
    )

    if (participantIndex === -1) {
      throw new Error("Session d'examen non trouvée")
    }

    const participant = exam.participants[participantIndex]

    // Validate current state
    if (participant.status !== "in_progress") {
      throw new Error("L'examen n'est pas en cours")
    }

    if (participant.pausePhase !== "before_pause") {
      throw new Error("La pause ne peut être démarrée qu'une seule fois")
    }

    const now = Date.now()

    // For auto-trigger (not manual), validate timing: exam timer must be at least at 50% elapsed
    if (!args.manualTrigger) {
      const startedAt = participant.startedAt || now
      const elapsedTime = now - startedAt
      const totalTime = exam.completionTime * 1000
      const halfTime = totalTime / 2

      // Allow 10 seconds tolerance for timing
      if (elapsedTime < halfTime - 10000) {
        throw new Error(
          "La pause automatique ne peut être déclenchée qu'à la mi-parcours du chronomètre",
        )
      }
    }

    // Update participant to pause state
    const updatedParticipants = [...exam.participants]
    updatedParticipants[participantIndex] = {
      ...participant,
      pausePhase: "during_pause",
      pauseStartedAt: now,
    }

    await ctx.db.patch(args.examId, {
      participants: updatedParticipants,
    })

    return {
      pauseStartedAt: now,
      pauseDurationMinutes: exam.pauseDurationMinutes || 15,
    }
  },
})

/**
 * Resume from pause (can be called before pause timer expires = cut short)
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

    const participantIndex = exam.participants.findIndex(
      (p) => p.userId === user._id,
    )

    if (participantIndex === -1) {
      throw new Error("Session d'examen non trouvée")
    }

    const participant = exam.participants[participantIndex]

    // Validate current state
    if (participant.status !== "in_progress") {
      throw new Error("L'examen n'est pas en cours")
    }

    if (participant.pausePhase !== "during_pause") {
      throw new Error("Vous n'êtes pas actuellement en pause")
    }

    const now = Date.now()
    const pauseStartedAt = participant.pauseStartedAt || now
    const pauseDurationMs = (exam.pauseDurationMinutes || 15) * 60 * 1000
    const pauseEndTime = pauseStartedAt + pauseDurationMs

    // Determine if pause was cut short (resumed before timer expired)
    const isPauseCutShort = now < pauseEndTime

    // Calculate actual pause duration used (to freeze exam timer)
    const actualPauseDurationMs = now - pauseStartedAt

    // Update participant to after_pause state
    const updatedParticipants = [...exam.participants]
    updatedParticipants[participantIndex] = {
      ...participant,
      pausePhase: "after_pause",
      pauseEndedAt: now,
      isPauseCutShort,
      totalPauseDurationMs: actualPauseDurationMs,
    }

    await ctx.db.patch(args.examId, {
      participants: updatedParticipants,
    })

    return {
      pauseEndedAt: now,
      isPauseCutShort,
      totalPauseDurationMs: actualPauseDurationMs,
    }
  },
})

/**
 * Query to validate if a user can access a specific question
 * Used by frontend to enforce question locking during pause phases
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

    // If pause is not enabled, all questions are accessible
    if (!exam.enablePause) {
      return { allowed: true }
    }

    const participant = exam.participants.find((p) => p.userId === user._id)

    if (!participant) {
      return { allowed: false, reason: "Session non trouvée" }
    }

    const totalQuestions = exam.questionIds.length
    const midpoint = Math.floor(totalQuestions / 2)
    const questionIndex = args.questionIndex

    switch (participant.pausePhase) {
      case "before_pause":
        // Can only access first half (0 to midpoint-1)
        if (questionIndex >= midpoint) {
          return {
            allowed: false,
            reason:
              "Cette question sera déverrouillée après la pause obligatoire",
          }
        }
        return { allowed: true }

      case "during_pause":
        // All questions locked during pause
        return {
          allowed: false,
          reason: "Questions verrouillées pendant la pause",
        }

      case "after_pause":
        // All questions unlocked after pause
        return { allowed: true }

      default:
        // No pause phase set (shouldn't happen for 100+ question exams)
        return { allowed: true }
    }
  },
})

/**
 * Query to get pause status and information
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

    const participant = exam.participants.find((p) => p.userId === user._id)

    if (!participant) {
      return null
    }

    const totalQuestions = exam.questionIds.length
    const midpoint = Math.floor(totalQuestions / 2)

    return {
      enablePause: exam.enablePause ?? false,
      pauseDurationMinutes: exam.pauseDurationMinutes ?? 15,
      pausePhase: participant.pausePhase,
      pauseStartedAt: participant.pauseStartedAt,
      pauseEndedAt: participant.pauseEndedAt,
      isPauseCutShort: participant.isPauseCutShort,
      totalQuestions,
      midpoint,
      // Calculated fields for UI
      questionsBeforePause: midpoint,
      questionsAfterPause: totalQuestions - midpoint,
    }
  },
})

// ==========================================
// V2 API - NORMALIZED TABLES
// Uses examParticipations + examAnswers tables
// ==========================================

/**
 * V2: Start exam session using normalized tables
 * Creates a participation record instead of adding to embedded array
 */
export const startExamV2 = mutation({
  args: {
    examId: v.id("exams"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)

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
        q.eq("examId", args.examId).eq("userId", user._id)
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
 * V2: Submit exam answers using normalized tables
 * Writes to examAnswers table instead of embedded array
 */
export const submitExamAnswersV2 = mutation({
  args: {
    examId: v.id("exams"),
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedAnswer: v.string(),
      })
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
        q.eq("examId", args.examId).eq("userId", user._id)
      )
      .unique()

    if (!participation) {
      throw new Error(
        "Session d'examen non trouvée. Vous devez d'abord démarrer l'examen."
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
        "Temps écoulé ! La soumission n'a pas pu être traitée à temps."
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
            `Tentative frauduleuse détectée : réponse soumise à une question verrouillée (Q${questionIndex + 1})`
          )
        }

        if (participation.pausePhase === "during_pause") {
          throw new Error(
            "Soumission non autorisée pendant la pause. Veuillez reprendre l'examen."
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
        }
      })
    } else {
      // Fallback: read questions from DB
      const questions = await Promise.all(
        exam.questionIds.map(async (questionId) => {
          return await ctx.db.get(questionId)
        })
      )

      answersWithCorrectness = args.answers.map((answer) => {
        const question = questions.find((q) => q?._id === answer.questionId)
        const isCorrect = question?.correctAnswer === answer.selectedAnswer
        return {
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect,
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
 * V2: Get exam session using normalized tables
 */
export const getExamSessionV2 = query({
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
        q.eq("examId", args.examId).eq("userId", user._id)
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
 * V2: Get participant exam results using normalized tables
 */
export const getParticipantExamResultsV2 = query({
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
        q.eq("examId", args.examId).eq("userId", args.userId)
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
      })
    )

    // Get answers from examAnswers table (indexed query)
    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_participation", (q) =>
        q.eq("participationId", participation._id)
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
 * V2: Start pause using normalized tables
 */
export const startPauseV2 = mutation({
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
        q.eq("examId", args.examId).eq("userId", user._id)
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
          "La pause automatique ne peut être déclenchée qu'à la mi-parcours du chronomètre"
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
 * V2: Resume from pause using normalized tables
 */
export const resumeFromPauseV2 = mutation({
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
        q.eq("examId", args.examId).eq("userId", user._id)
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
 * V2: Get pause status using normalized tables
 */
export const getPauseStatusV2 = query({
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
        q.eq("examId", args.examId).eq("userId", user._id)
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
 * V2: Validate question access using normalized tables
 */
export const validateQuestionAccessV2 = query({
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
        q.eq("examId", args.examId).eq("userId", user._id)
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
 * V2: Get exam leaderboard using normalized tables
 */
export const getExamLeaderboardV2 = query({
  args: { examId: v.id("exams") },
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId)
    if (!exam) {
      throw new Error("Examen non trouvé")
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
          (p) => p.status === "completed" || p.status === "auto_submitted"
        )
        .map(async (participation) => {
          const user = await ctx.db.get(participation.userId)
          return {
            user,
            score: participation.score,
            completedAt: participation.completedAt,
          }
        })
    )

    // Sort by score descending
    return leaderboard
      .filter((entry) => entry.user !== null)
      .sort((a, b) => b.score - a.score)
  },
})

/**
 * V2: Get all exams metadata with participant counts from normalized tables
 */
export const getAllExamsMetadataV2 = query({
  handler: async (ctx) => {
    const exams = await ctx.db.query("exams").order("desc").collect()

    // Get participation counts efficiently
    const examsWithMetadata = await Promise.all(
      exams.map(async (exam) => {
        // Count participations for this exam
        const participations = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam", (q) => q.eq("examId", exam._id))
          .collect()

        return {
          _id: exam._id,
          _creationTime: exam._creationTime,
          title: exam.title,
          description: exam.description,
          startDate: exam.startDate,
          endDate: exam.endDate,
          completionTime: exam.completionTime,
          isActive: exam.isActive,
          questionCount: exam.questionIds.length,
          participantCount: participations.length,
          // V2: Also include legacy count for hybrid period
          legacyParticipantCount: exam.participants.length,
        }
      })
    )

    return examsWithMetadata
  },
})

/**
 * V2: Get all exams without embedded participants (for admin list)
 * Returns exams with participant count from normalized tables
 */
export const getAllExamsV2 = query({
  handler: async (ctx) => {
    const exams = await ctx.db.query("exams").order("desc").collect()

    // Return exams without the embedded participants array
    // Include participant count from V2 tables
    const examsWithoutParticipants = await Promise.all(
      exams.map(async (exam) => {
        // Count participations for this exam
        const participations = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam", (q) => q.eq("examId", exam._id))
          .collect()

        // Destructure to exclude participants array
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { participants, ...examWithoutParticipants } = exam

        return {
          ...examWithoutParticipants,
          // Add participant count for display
          participantCount: participations.length,
        }
      })
    )

    return examsWithoutParticipants
  },
})

/**
 * V2: Get user's dashboard stats using normalized tables
 */
export const getMyDashboardStatsV2 = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return null
    }

    // Get all exams user has access to
    const allExams = await ctx.db.query("exams").collect()
    const myExams = allExams.filter((exam) =>
      exam.allowedParticipants.includes(user._id)
    )

    // Get user's participations from V2 tables
    const myParticipations = await ctx.db
      .query("examParticipations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    const completedParticipations = myParticipations.filter(
      (p) => p.status === "completed" || p.status === "auto_submitted"
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
 * V2: Get user's recent exams using normalized tables
 */
export const getMyRecentExamsV2 = query({
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
    const participationMap = new Map(
      myParticipations.map((p) => [p.examId, p])
    )

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
          score: isCompleted ? participation?.score ?? null : null,
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
 * V2: Get all exams with current user's participation status
 * Used by mock-exam page to show exam list with "already taken" status
 */
export const getAllExamsWithUserParticipationV2 = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx)
    const exams = await ctx.db.query("exams").order("desc").collect()

    if (!user) {
      // Return exams without participation info for non-authenticated users
      return exams.map((exam) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { participants, ...examWithoutParticipants } = exam
        return {
          ...examWithoutParticipants,
          userHasTaken: false,
          userParticipation: null,
        }
      })
    }

    // Get user's participations in a single query
    const userParticipations = await ctx.db
      .query("examParticipations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    // Create a map for O(1) lookup
    const participationMap = new Map(
      userParticipations.map((p) => [p.examId, p])
    )

    return exams.map((exam) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { participants, ...examWithoutParticipants } = exam
      const participation = participationMap.get(exam._id)

      return {
        ...examWithoutParticipants,
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
