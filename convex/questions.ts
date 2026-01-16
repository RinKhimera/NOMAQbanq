import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { getAdminUserOrThrow } from "./lib/auth"

// ============================================
// HELPERS POUR LA GESTION DES STATS
// ============================================

const TOTAL_DOMAIN_KEY = "__total__"

// Validation: empêcher l'utilisation de la clé réservée comme nom de domaine
const validateDomain = (domain: string) => {
  if (domain === TOTAL_DOMAIN_KEY) {
    throw new Error(`Le domaine "${TOTAL_DOMAIN_KEY}" est réservé`)
  }
}

// Helper: Incrémenter le compteur d'un domaine (et le total)
const incrementDomainCount = async (ctx: MutationCtx, domain: string) => {
  validateDomain(domain)
  // Mettre à jour le compteur du domaine
  const domainStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", domain))
    .unique()

  if (domainStat) {
    await ctx.db.patch(domainStat._id, { count: domainStat.count + 1 })
  } else {
    await ctx.db.insert("questionStats", { domain, count: 1 })
  }

  // Mettre à jour le total
  const totalStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
    .unique()

  if (totalStat) {
    await ctx.db.patch(totalStat._id, { count: totalStat.count + 1 })
  } else {
    await ctx.db.insert("questionStats", { domain: TOTAL_DOMAIN_KEY, count: 1 })
  }
}

// Helper: Décrémenter le compteur d'un domaine (et le total)
const decrementDomainCount = async (ctx: MutationCtx, domain: string) => {
  validateDomain(domain)

  // Mettre à jour le compteur du domaine
  const domainStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", domain))
    .unique()

  if (domainStat) {
    if (domainStat.count <= 1) {
      await ctx.db.delete(domainStat._id)
    } else {
      await ctx.db.patch(domainStat._id, { count: domainStat.count - 1 })
    }
  } else {
    // Stats désynchronisées - le domaine devrait exister
    console.warn(`[questionStats] Domaine "${domain}" introuvable lors du décrement`)
  }

  // Mettre à jour le total
  const totalStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
    .unique()

  if (totalStat && totalStat.count > 0) {
    await ctx.db.patch(totalStat._id, { count: totalStat.count - 1 })
  }
}

// Helper: Transférer le compteur d'un domaine à un autre (total inchangé)
const transferDomainCount = async (
  ctx: MutationCtx,
  oldDomain: string,
  newDomain: string,
) => {
  validateDomain(oldDomain)
  validateDomain(newDomain)

  // Décrémenter l'ancien domaine
  const oldDomainStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", oldDomain))
    .unique()

  if (oldDomainStat) {
    if (oldDomainStat.count <= 1) {
      await ctx.db.delete(oldDomainStat._id)
    } else {
      await ctx.db.patch(oldDomainStat._id, { count: oldDomainStat.count - 1 })
    }
  } else {
    console.warn(`[questionStats] Ancien domaine "${oldDomain}" introuvable lors du transfert`)
  }

  // Incrémenter le nouveau domaine
  const newDomainStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", newDomain))
    .unique()

  if (newDomainStat) {
    await ctx.db.patch(newDomainStat._id, { count: newDomainStat.count + 1 })
  } else {
    await ctx.db.insert("questionStats", { domain: newDomain, count: 1 })
  }
}

// ============================================
// MUTATIONS CRUD QUESTIONS
// ============================================

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

    // Mettre à jour les stats d'agrégation
    await incrementDomainCount(ctx, args.domain)

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

// Récupérer les statistiques des questions pour le dashboard admin (optimisé via table d'agrégation)
export const getQuestionStats = query({
  args: {},
  handler: async (ctx) => {
    // Lire depuis la table d'agrégation (beaucoup plus efficace que full scan)
    const allStats = await ctx.db.query("questionStats").collect()

    // Séparer le total des stats par domaine
    const totalStat = allStats.find((s) => s.domain === TOTAL_DOMAIN_KEY)
    const domainStats = allStats
      .filter((s) => s.domain !== TOTAL_DOMAIN_KEY)
      .map((s) => ({ domain: s.domain, count: s.count }))

    return {
      totalCount: totalStat?.count ?? 0,
      domainStats,
    }
  },
})

// Supprimer une question (admin seulement)
export const deleteQuestion = mutation({
  args: { id: v.id("questions") },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Récupérer la question pour connaître son domaine
    const question = await ctx.db.get(args.id)
    if (!question) {
      throw new Error("Question non trouvée")
    }

    await ctx.db.delete(args.id)

    // Mettre à jour les stats d'agrégation
    await decrementDomainCount(ctx, question.domain)
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
    await getAdminUserOrThrow(ctx)

    const { id, ...updateData } = args

    // Récupérer la question existante pour vérifier le changement de domaine
    const existingQuestion = await ctx.db.get(id)
    if (!existingQuestion) {
      throw new Error("Question non trouvée")
    }

    // Filtrer les valeurs undefined
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([, value]) => value !== undefined),
    )

    await ctx.db.patch(id, filteredData)

    // Si le domaine a changé, mettre à jour les stats
    if (args.domain !== undefined && args.domain !== existingQuestion.domain) {
      await transferDomainCount(ctx, existingQuestion.domain, args.domain)
    }
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

// ============================================
// MIGRATION: Initialiser les stats d'agrégation
// ============================================

// Migration pour peupler la table questionStats à partir des questions existantes
// À exécuter une seule fois après le déploiement du nouveau schéma
// Commande: npx convex run questions:seedQuestionStats
export const seedQuestionStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Vérifier si déjà initialisé (idempotent)
    const existingTotal = await ctx.db
      .query("questionStats")
      .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
      .unique()

    if (existingTotal) {
      console.log("Question stats already seeded")
      return { success: true, alreadySeeded: true }
    }

    // Full table scan (coût unique de migration)
    const allQuestions = await ctx.db.query("questions").collect()

    // Construire les compteurs par domaine
    const domainCounts = allQuestions.reduce(
      (acc, question) => {
        acc[question.domain] = (acc[question.domain] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Insérer les stats par domaine
    for (const [domain, count] of Object.entries(domainCounts)) {
      await ctx.db.insert("questionStats", { domain, count })
    }

    // Insérer le total
    await ctx.db.insert("questionStats", {
      domain: TOTAL_DOMAIN_KEY,
      count: allQuestions.length,
    })

    return {
      success: true,
      totalCount: allQuestions.length,
      domainsCount: Object.keys(domainCounts).length,
    }
  },
})
