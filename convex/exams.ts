import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Créer un nouvel examen
export const createExam = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    questionIds: v.array(v.id("questions")),
    allowedParticipants: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Utilisateur non authentifié")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

    if (!user || user.role !== "admin") {
      throw new Error("Accès non autorisé")
    }

    const completionTime = args.questionIds.length * 83

    const examId = await ctx.db.insert("exams", {
      title: args.title,
      description: args.description,
      startDate: args.startDate,
      endDate: args.endDate,
      questionIds: args.questionIds,
      completionTime,
      allowedParticipants: args.allowedParticipants,
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Utilisateur non authentifié")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

    if (!user || user.role !== "admin") {
      throw new Error("Accès non autorisé")
    }

    // Calculer le nouveau temps de completion: 83 secondes par question
    const completionTime = args.questionIds.length * 83

    await ctx.db.patch(args.examId, {
      title: args.title,
      description: args.description,
      startDate: args.startDate,
      endDate: args.endDate,
      questionIds: args.questionIds,
      completionTime,
      allowedParticipants: args.allowedParticipants,
    })

    return { success: true }
  },
})

// Supprimer un examen
export const deleteExam = mutation({
  args: { examId: v.id("exams") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Utilisateur non authentifié")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

    if (!user || user.role !== "admin") {
      throw new Error("Accès non autorisé")
    }

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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Utilisateur non authentifié")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

    if (!user) {
      throw new Error("Utilisateur non trouvé")
    }

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

    // Vérifier si l'utilisateur a déjà passé cet examen
    const hasAlreadyTaken = exam.participants.some((p) => p.userId === user._id)
    if (hasAlreadyTaken) {
      throw new Error("Vous avez déjà passé cet examen")
    }

    // Calculer le score
    const questions = await Promise.all(
      exam.questionIds.map(async (questionId) => {
        return await ctx.db.get(questionId)
      }),
    )

    const answersWithCorrectness = args.answers.map((answer) => {
      const question = questions.find((q) => q?._id === answer.questionId)
      const isCorrect = question?.correctAnswer === answer.selectedAnswer
      return {
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
      }
    })

    const score = answersWithCorrectness.filter((a) => a.isCorrect).length
    const totalQuestions = exam.questionIds.length
    const percentage = Math.round((score / totalQuestions) * 100)

    // Ajouter le participant à l'examen
    const newParticipant = {
      userId: user._id,
      score: percentage,
      completedAt: now,
      answers: answersWithCorrectness,
    }

    // Mettre à jour l'examen avec le nouveau participant
    const updatedParticipants = [...exam.participants, newParticipant]

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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Utilisateur non authentifié")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

    if (!user || user.role !== "admin") {
      throw new Error("Accès non autorisé")
    }

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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Utilisateur non authentifié")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

    if (!user || user.role !== "admin") {
      throw new Error("Accès non autorisé")
    }

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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique()

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
