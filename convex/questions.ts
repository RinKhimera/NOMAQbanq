import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Créer une nouvelle question
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

// Récupérer les domaines uniques

// Supprimer une question
export const deleteQuestion = mutation({
  args: { id: v.id("questions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// Mettre à jour une question
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
    const { id, ...updateData } = args
    // Filtrer les valeurs undefined
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([, value]) => value !== undefined),
    )
    await ctx.db.patch(id, filteredData)
  },
})

// Fonctions pour la banque d'apprentissage
export const getLearningBankQuestions = query({
  args: {},
  handler: async (ctx) => {
    const learningBankEntries = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    const questionsWithDetails = await Promise.all(
      learningBankEntries.map(async (entry) => {
        const question = await ctx.db.get(entry.questionId)
        const addedByUser = await ctx.db.get(entry.addedBy)
        return {
          ...entry,
          question,
          addedByUser,
        }
      }),
    )

    return questionsWithDetails
  },
})

export const addQuestionToLearningBank = mutation({
  args: {
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Non authentifié")
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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Non authentifié")
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
    // Récupérer toutes les questions de la banque d'apprentissage
    const learningBankItems = await ctx.db
      .query("learningBankQuestions")
      .filter((q) => q.eq(q.field("isActive"), true))
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

// Pagination + Filtres pour l'admin (OPTIMISÉ)
export const getQuestionsWithPagination = query({
  args: {
    page: v.number(),
    limit: v.number(),
    domain: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { page, limit, domain, searchQuery } = args

    // Récupérer toutes les questions (on pourrait optimiser avec des index)
    let questions = await ctx.db.query("questions").order("desc").collect()

    // Filtrer par domaine
    if (domain && domain !== "Tous les domaines") {
      questions = questions.filter((q) => q.domain === domain)
    }

    // Filtrer par recherche (côté serveur)
    if (searchQuery && searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase()
      questions = questions.filter(
        (q) =>
          q.question.toLowerCase().includes(lowerQuery) ||
          q.objectifCMC.toLowerCase().includes(lowerQuery),
      )
    }

    // Calculer la pagination
    const totalQuestions = questions.length
    const totalPages = Math.ceil(totalQuestions / limit)
    const offset = (page - 1) * limit
    const paginatedQuestions = questions.slice(offset, offset + limit)

    return {
      questions: paginatedQuestions,
      totalQuestions,
      totalPages,
      currentPage: page,
    }
  },
})

// Pagination pour la banque d'apprentissage (OPTIMISÉ)
export const getLearningBankQuestionsWithPagination = query({
  args: {
    page: v.number(),
    limit: v.number(),
    domain: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { page, limit, domain, searchQuery } = args

    // Récupérer les entrées actives de la banque d'apprentissage
    const learningBankEntries = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    // Récupérer les détails des questions
    const questionsWithDetails = await Promise.all(
      learningBankEntries.map(async (entry) => {
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

    // Filtrer par domaine
    if (domain && domain !== "all") {
      filteredItems = filteredItems.filter(
        (item) => item.question?.domain === domain,
      )
    }

    // Filtrer par recherche
    if (searchQuery && searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase()
      filteredItems = filteredItems.filter(
        (item) =>
          item.question?.question.toLowerCase().includes(lowerQuery) ||
          item.question?.domain.toLowerCase().includes(lowerQuery),
      )
    }

    // Calculer la pagination
    const totalItems = filteredItems.length
    const totalPages = Math.ceil(totalItems / limit)
    const offset = (page - 1) * limit
    const paginatedItems = filteredItems.slice(offset, offset + limit)

    return {
      items: paginatedItems,
      totalItems,
      totalPages,
      currentPage: page,
    }
  },
})

// Pagination pour les questions disponibles (non dans la banque) (OPTIMISÉ)
export const getAvailableQuestionsWithPagination = query({
  args: {
    page: v.number(),
    limit: v.number(),
    domain: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { page, limit, domain, searchQuery } = args

    // Récupérer toutes les questions
    const allQuestions = await ctx.db.query("questions").collect()

    // Récupérer les IDs des questions dans la banque d'apprentissage
    const learningBankEntries = await ctx.db
      .query("learningBankQuestions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect()

    const learningBankQuestionIds = new Set(
      learningBankEntries.map((entry) => entry.questionId),
    )

    // Filtrer les questions qui ne sont PAS dans la banque
    let availableQuestions = allQuestions.filter(
      (question) => !learningBankQuestionIds.has(question._id),
    )

    // Filtrer par domaine
    if (domain && domain !== "all") {
      availableQuestions = availableQuestions.filter((q) => q.domain === domain)
    }

    // Filtrer par recherche
    if (searchQuery && searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase()
      availableQuestions = availableQuestions.filter(
        (q) =>
          q.question.toLowerCase().includes(lowerQuery) ||
          q.domain.toLowerCase().includes(lowerQuery),
      )
    }

    // Calculer la pagination
    const totalQuestions = availableQuestions.length
    const totalPages = Math.ceil(totalQuestions / limit)
    const offset = (page - 1) * limit
    const paginatedQuestions = availableQuestions.slice(offset, offset + limit)

    return {
      questions: paginatedQuestions,
      totalQuestions,
      totalPages,
      currentPage: page,
    }
  },
})
