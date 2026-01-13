import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getAdminUserOrThrow, getCurrentUserOrNull } from "./lib/auth"

// Créer une nouvelle question (admin seulement)
export const createQuestion = mutation({
  args: {
    question: v.string(),
    imageSrc: v.optional(v.string()),
    options: v.array(v.string()),
    correctAnswer: v.string(),
    explanation: v.string(),
    references: v.optional(v.array(v.string())),
    objectifCMC: v.string(),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // Vérifier que l'utilisateur est admin
    await getAdminUserOrThrow(ctx)

    const questionId = await ctx.db.insert("questions", {
      question: args.question,
      imageSrc: args.imageSrc,
      options: args.options,
      correctAnswer: args.correctAnswer,
      explanation: args.explanation,
      references: args.references,
      objectifCMC: args.objectifCMC,
      domain: args.domain,
    })
    return questionId
  },
})

// Récupérer toutes les questions
export const getAllQuestions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("questions").order("desc").collect()
  },
})

// Récupérer les statistiques des questions pour le dashboard admin (optimisé)
export const getQuestionStats = query({
  args: {},
  handler: async (ctx) => {
    const allQuestions = await ctx.db.query("questions").collect()

    const domainCountsMap = allQuestions.reduce(
      (acc, question) => {
        acc[question.domain] = (acc[question.domain] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const domainStats = Object.entries(domainCountsMap).map(
      ([domain, count]) => ({
        domain,
        count,
      }),
    )

    return {
      totalCount: allQuestions.length,
      domainStats,
    }
  },
})

// Supprimer une question (admin seulement)
export const deleteQuestion = mutation({
  args: { id: v.id("questions") },
  handler: async (ctx, args) => {
    // Vérifier que l'utilisateur est admin
    await getAdminUserOrThrow(ctx)

    await ctx.db.delete(args.id)
  },
})

// Mettre à jour une question (admin seulement)
export const updateQuestion = mutation({
  args: {
    id: v.id("questions"),
    question: v.optional(v.string()),
    imageSrc: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
    explanation: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    objectifCMC: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Vérifier que l'utilisateur est admin
    await getAdminUserOrThrow(ctx)

    const { id, ...updateData } = args
    // Filtrer les valeurs undefined
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([, value]) => value !== undefined),
    )
    await ctx.db.patch(id, filteredData)
  },
})

// Fonctions pour la banque d'apprentissage (optimisé)
export const getLearningBankQuestions = query({
  args: {},
  handler: async (ctx) => {
    // Vérifier l'accès payant à l'entraînement
    const user = await getCurrentUserOrNull(ctx)
    if (!user) return []

    if (user.role !== "admin") {
      const trainingAccess = await ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "training"),
        )
        .unique()

      if (!trainingAccess || trainingAccess.expiresAt < Date.now()) {
        return []
      }
    }

    const learningBankEntries = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    // Retourner seulement les données essentielles
    const questionsWithDetails = await Promise.all(
      learningBankEntries.map(async (entry) => {
        const question = await ctx.db.get(entry.questionId)
        if (!question) return null

        // Ne charger que le domaine de la question (pas tous les détails)
        return {
          _id: entry._id,
          _creationTime: entry._creationTime,
          questionId: entry.questionId,
          addedBy: entry.addedBy,
          isActive: entry.isActive,
          question: {
            _id: question._id,
            domain: question.domain,
            question: question.question,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            objectifCMC: question.objectifCMC,
            imageSrc: question.imageSrc,
            references: question.references,
          },
        }
      }),
    )

    return questionsWithDetails.filter((q) => q !== null)
  },
})

export const addQuestionToLearningBank = mutation({
  args: {
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    const user = await getAdminUserOrThrow(ctx)

    // Vérifier si la question existe déjà dans la banque d'apprentissage
    const existingEntry = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_questionId", (q) => q.eq("questionId", args.questionId))
      .first()

    if (existingEntry) {
      // Si elle existe mais est inactive, la réactiver
      if (!existingEntry.isActive) {
        await ctx.db.patch(existingEntry._id, {
          isActive: true,
          addedBy: user._id,
          addedAt: Date.now(),
        })
      }
      return existingEntry._id
    }

    // Ajouter la nouvelle question
    const learningBankQuestionId = await ctx.db.insert(
      "learningBankQuestions",
      {
        questionId: args.questionId,
        addedBy: user._id,
        addedAt: Date.now(),
        isActive: true,
      },
    )

    return learningBankQuestionId
  },
})

export const removeQuestionFromLearningBank = mutation({
  args: {
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const entry = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_questionId", (q) => q.eq("questionId", args.questionId))
      .first()

    if (entry) {
      await ctx.db.patch(entry._id, { isActive: false })
    }
  },
})

export const getQuestionsNotInLearningBank = query({
  args: {},
  handler: async (ctx) => {
    // Récupérer toutes les questions
    const allQuestions = await ctx.db.query("questions").collect()

    // Récupérer toutes les questions actives dans la banque d'apprentissage
    const learningBankEntries = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    const learningBankQuestionIds = new Set(
      learningBankEntries.map((entry) => entry.questionId),
    )

    // Filtrer les questions qui ne sont pas dans la banque d'apprentissage
    return allQuestions.filter(
      (question) => !learningBankQuestionIds.has(question._id),
    )
  },
})

// Fonction pour récupérer des questions aléatoires de la banque d'apprentissage
export const getRandomLearningBankQuestions = query({
  args: {
    count: v.number(),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, { count, domain }) => {
    // Vérifier l'accès payant à l'entraînement
    const user = await getCurrentUserOrNull(ctx)
    if (!user) return []

    if (user.role !== "admin") {
      const trainingAccess = await ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "training"),
        )
        .unique()

      if (!trainingAccess || trainingAccess.expiresAt < Date.now()) {
        return []
      }
    }

    // Use index for active questions (more efficient than .filter())
    const learningBankItems = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    // Joindre avec les questions pour avoir les détails
    const questionsWithDetails = await Promise.all(
      learningBankItems.map(async (item) => {
        const question = await ctx.db.get(item.questionId)
        return question
      }),
    )

    // Filtrer les questions valides
    let validQuestions = questionsWithDetails.filter(
      (q): q is NonNullable<typeof q> => q !== null,
    )

    // Filtrer par domaine si spécifié
    if (domain) {
      validQuestions = validQuestions.filter((q) => q.domain === domain)
    }

    // Mélanger les questions (algorithme de Fisher-Yates)
    const shuffled = [...validQuestions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Retourner le nombre demandé de questions
    return shuffled.slice(0, Math.min(count, shuffled.length))
  },
})

// Pagination + Filtres pour l'admin (CURSOR-BASED)
// Note: Cursor-based pagination is optimal for index-based queries.
// When search or complex filters are applied, we need to collect first then paginate in memory.
export const getQuestionsWithPagination = query({
  args: {
    paginationOpts: paginationOptsValidator,
    domain: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { paginationOpts, domain, searchQuery } = args
    const hasDomainFilter = domain && domain !== "Tous les domaines"
    const hasSearchQuery = searchQuery && searchQuery.trim() !== ""

    // CASE 1: Domain filter only (can use cursor pagination on index)
    if (hasDomainFilter && !hasSearchQuery) {
      return await ctx.db
        .query("questions")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .order("desc")
        .paginate(paginationOpts)
    }

    // CASE 2: Search query (requires JS filter, collect then paginate)
    // Note: For text search, we need to collect all results, filter, then manually paginate
    // This is less optimal but unavoidable without full-text search index
    if (hasSearchQuery) {
      const lowerQuery = searchQuery.toLowerCase()

      // Get base query results
      let baseQuery = ctx.db.query("questions").order("desc")

      // If domain filter exists, apply it via index
      if (hasDomainFilter) {
        baseQuery = ctx.db
          .query("questions")
          .withIndex("by_domain", (q) => q.eq("domain", domain))
          .order("desc")
      }

      // Collect all for filtering
      const allQuestions = await baseQuery.collect()

      // Filter by search query
      const filteredQuestions = allQuestions.filter(
        (q) =>
          q.question.toLowerCase().includes(lowerQuery) ||
          q.objectifCMC.toLowerCase().includes(lowerQuery),
      )

      // Manual pagination for filtered results
      const startIndex = paginationOpts.cursor
        ? parseInt(paginationOpts.cursor, 10)
        : 0
      const endIndex = startIndex + paginationOpts.numItems
      const pageResults = filteredQuestions.slice(startIndex, endIndex)
      const hasMore = endIndex < filteredQuestions.length

      return {
        page: pageResults,
        continueCursor: hasMore ? endIndex.toString() : "",
        isDone: !hasMore,
      }
    }

    // CASE 3: No filters (use default cursor pagination)
    return await ctx.db
      .query("questions")
      .order("desc")
      .paginate(paginationOpts)
  },
})

// Pagination pour la banque d'apprentissage
export const getLearningBankQuestionsWithPagination = query({
  args: {
    paginationOpts: paginationOptsValidator,
    domain: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { paginationOpts, domain, searchQuery } = args

    // Vérifier l'accès payant à l'entraînement
    const user = await getCurrentUserOrNull(ctx)
    if (!user) {
      return { page: [], continueCursor: "", isDone: true }
    }

    if (user.role !== "admin") {
      const trainingAccess = await ctx.db
        .query("userAccess")
        .withIndex("by_userId_accessType", (q) =>
          q.eq("userId", user._id).eq("accessType", "training"),
        )
        .unique()

      if (!trainingAccess || trainingAccess.expiresAt < Date.now()) {
        return { page: [], continueCursor: "", isDone: true }
      }
    }

    // Récupérer les entrées actives de la banque d'apprentissage avec cursor pagination
    const learningBankResult = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .paginate(paginationOpts)

    // Récupérer les détails des questions pour cette page
    const questionsWithDetails = await Promise.all(
      learningBankResult.page.map(async (entry) => {
        const question = await ctx.db.get(entry.questionId)
        const addedByUser = await ctx.db.get(entry.addedBy)
        return {
          ...entry,
          question,
          addedByUser,
        }
      }),
    )

    // Filtrer les questions nulles
    let filteredItems = questionsWithDetails.filter(
      (item) => item.question !== null,
    )

    // Filtrer par domaine si nécessaire
    if (domain && domain !== "all") {
      filteredItems = filteredItems.filter(
        (item) => item.question?.domain === domain,
      )
    }

    // Filtrer par recherche si nécessaire
    if (searchQuery && searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase()
      filteredItems = filteredItems.filter(
        (item) =>
          item.question?.question.toLowerCase().includes(lowerQuery) ||
          item.question?.domain.toLowerCase().includes(lowerQuery),
      )
    }

    return {
      page: filteredItems,
      continueCursor: learningBankResult.continueCursor,
      isDone: learningBankResult.isDone,
    }
  },
})

// Pagination pour les questions disponibles (non dans la banque) (CURSOR-BASED)
export const getAvailableQuestionsWithPagination = query({
  args: {
    paginationOpts: paginationOptsValidator,
    domain: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { paginationOpts, domain, searchQuery } = args

    const learningBankEntries = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    const learningBankQuestionIds = new Set(
      learningBankEntries.map((entry) => entry.questionId),
    )

    // Paginate all questions (or by domain if specified)
    let questionsPaginated
    if (domain && domain !== "all") {
      questionsPaginated = await ctx.db
        .query("questions")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .paginate(paginationOpts)
    } else {
      questionsPaginated = await ctx.db
        .query("questions")
        .paginate(paginationOpts)
    }

    // Filter out questions that are in learning bank
    let availableQuestions = questionsPaginated.page.filter(
      (question) => !learningBankQuestionIds.has(question._id),
    )

    // Apply search filter if provided
    if (searchQuery && searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase()
      availableQuestions = availableQuestions.filter(
        (q) =>
          q.question.toLowerCase().includes(lowerQuery) ||
          q.domain.toLowerCase().includes(lowerQuery),
      )
    }

    return {
      page: availableQuestions,
      continueCursor: questionsPaginated.continueCursor,
      isDone: questionsPaginated.isDone,
    }
  },
})

// Obtenir des questions aléatoires (optimisé pour quiz)
export const getRandomQuestions = query({
  args: {
    count: v.number(),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let questions

    // Use index when filtering by domain
    if (args.domain && args.domain !== "all") {
      questions = await ctx.db
        .query("questions")
        .withIndex("by_domain", (q) => q.eq("domain", args.domain!))
        .collect()
    } else {
      questions = await ctx.db.query("questions").collect()
    }

    // Mélanger les questions (Fisher-Yates shuffle)
    const shuffled = [...questions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Retourner le nombre demandé
    return shuffled.slice(0, Math.min(args.count, shuffled.length))
  },
})
