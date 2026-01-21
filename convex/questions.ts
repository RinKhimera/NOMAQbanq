import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { getAdminUserOrThrow } from "./lib/auth"
import { deleteFromBunny } from "./lib/bunny"

// ============================================
// TYPES POUR LES IMAGES
// ============================================

const questionImageValidator = v.object({
  url: v.string(),
  storagePath: v.string(),
  order: v.number(),
})

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
    options: v.array(v.string()),
    correctAnswer: v.string(),
    explanation: v.string(),
    references: v.optional(v.array(v.string())),
    objectifCMC: v.string(),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Normaliser l'objectifCMC (trim + majuscule initiale)
    const normalizedObjectif = normalizeObjectifCMC(args.objectifCMC)

    const questionId = await ctx.db.insert("questions", {
      question: args.question,
      options: args.options,
      correctAnswer: args.correctAnswer,
      explanation: args.explanation,
      references: args.references,
      objectifCMC: normalizedObjectif,
      domain: args.domain,
    })

    // Mettre à jour les stats d'agrégation
    await incrementDomainCount(ctx, args.domain)

    return questionId
  },
})

// Récupérer toutes les questions (limité pour performance)
// Note: Use getQuestionsWithPagination for large datasets
export const getAllQuestions = query({
  args: {},
  handler: async (ctx) => {
    // Limit to 1000 questions to prevent unbounded reads
    // For full list, use paginated query
    return await ctx.db.query("questions").order("desc").take(1000)
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

// Récupérer les statistiques enrichies pour la page admin questions
export const getQuestionStatsEnriched = query({
  args: {},
  handler: async (ctx) => {
    // Lire depuis la table d'agrégation
    const allStats = await ctx.db.query("questionStats").collect()

    // Séparer le total des stats par domaine
    const totalStat = allStats.find((s) => s.domain === TOTAL_DOMAIN_KEY)
    const domainStats = allStats
      .filter((s) => s.domain !== TOTAL_DOMAIN_KEY)
      .map((s) => ({ domain: s.domain, count: s.count }))
      .sort((a, b) => b.count - a.count)

    // Pour les stats images, on doit faire un scan (pas d'index sur images)
    // On limite à 5000 pour performance
    const questions = await ctx.db.query("questions").take(5000)
    const withImagesCount = questions.filter(
      (q) => q.images && q.images.length > 0
    ).length
    const withoutImagesCount = questions.length - withImagesCount

    return {
      totalCount: totalStat?.count ?? 0,
      withImagesCount,
      withoutImagesCount,
      uniqueDomainsCount: domainStats.length,
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

    // Normaliser l'objectifCMC si fourni
    if (updateData.objectifCMC !== undefined) {
      updateData.objectifCMC = normalizeObjectifCMC(updateData.objectifCMC)
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


// Pagination + Filtres pour l'admin (CURSOR-BASED) - Version legacy
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

// ============================================
// NOUVELLES QUERIES POUR LA PAGE ADMIN REDESIGNÉE
// ============================================

// Version améliorée avec filtres avancés et tri
export const getQuestionsWithFilters = query({
  args: {
    paginationOpts: paginationOptsValidator,
    searchQuery: v.optional(v.string()),
    domain: v.optional(v.string()),
    hasImages: v.optional(v.boolean()),
    sortBy: v.optional(
      v.union(
        v.literal("_creationTime"),
        v.literal("question"),
        v.literal("domain")
      )
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const {
      paginationOpts,
      searchQuery,
      domain,
      hasImages,
      sortBy = "_creationTime",
      sortOrder = "desc",
    } = args

    const hasDomainFilter = domain && domain !== "all"
    const hasSearchFilter = searchQuery && searchQuery.trim() !== ""
    const hasImagesFilter = hasImages !== undefined
    const hasCustomSort = sortBy !== "_creationTime"

    // Si on a des filtres complexes (search, images) ou un tri personnalisé,
    // on doit collecter et filtrer/trier en JS
    const needsJsFilter = hasSearchFilter || hasImagesFilter || hasCustomSort

    if (needsJsFilter) {
      // Collecter les questions (avec index domaine si possible)
      let questions
      if (hasDomainFilter) {
        questions = await ctx.db
          .query("questions")
          .withIndex("by_domain", (q) => q.eq("domain", domain))
          .collect()
      } else {
        questions = await ctx.db.query("questions").collect()
      }

      // Appliquer les filtres JS
      let filtered = questions

      if (hasSearchFilter) {
        const lowerQuery = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (q) =>
            q.question.toLowerCase().includes(lowerQuery) ||
            q.objectifCMC.toLowerCase().includes(lowerQuery)
        )
      }

      if (hasImagesFilter) {
        filtered = filtered.filter((q) => {
          const questionHasImages = q.images && q.images.length > 0
          return hasImages ? questionHasImages : !questionHasImages
        })
      }

      // Appliquer le tri
      filtered.sort((a, b) => {
        let comparison = 0
        switch (sortBy) {
          case "question":
            comparison = a.question.localeCompare(b.question, "fr")
            break
          case "domain":
            comparison = a.domain.localeCompare(b.domain, "fr")
            break
          case "_creationTime":
          default:
            comparison = a._creationTime - b._creationTime
        }
        return sortOrder === "desc" ? -comparison : comparison
      })

      // Pagination manuelle
      const startIndex = paginationOpts.cursor
        ? parseInt(paginationOpts.cursor, 10)
        : 0
      const endIndex = startIndex + paginationOpts.numItems
      const pageResults = filtered.slice(startIndex, endIndex)
      const hasMore = endIndex < filtered.length

      return {
        page: pageResults,
        continueCursor: hasMore ? endIndex.toString() : "",
        isDone: !hasMore,
      }
    }

    // Sans filtres complexes, utiliser la pagination Convex native
    const order = sortOrder === "desc" ? "desc" : "asc"

    if (hasDomainFilter) {
      return await ctx.db
        .query("questions")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .order(order)
        .paginate(paginationOpts)
    }

    return await ctx.db
      .query("questions")
      .order(order)
      .paginate(paginationOpts)
  },
})

// Récupérer une question par son ID (pour le panel et l'édition)
export const getQuestionById = query({
  args: { questionId: v.id("questions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.questionId)
  },
})

// Récupérer tous les objectifs CMC uniques (pour le combobox)
export const getUniqueObjectifsCMC = query({
  args: {},
  handler: async (ctx) => {
    // Collecter toutes les questions (limité pour performance)
    const questions = await ctx.db.query("questions").take(5000)

    // Extraire les objectifs uniques
    const objectifsSet = new Set<string>()
    for (const q of questions) {
      if (q.objectifCMC && q.objectifCMC.trim()) {
        objectifsSet.add(q.objectifCMC.trim())
      }
    }

    // Trier alphabétiquement
    return Array.from(objectifsSet).sort((a, b) => a.localeCompare(b, "fr"))
  },
})

// Récupérer toutes les questions pour l'export (avec filtres)
export const getAllQuestionsForExport = query({
  args: {
    searchQuery: v.optional(v.string()),
    domain: v.optional(v.string()),
    hasImages: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { searchQuery, domain, hasImages } = args
    const hasDomainFilter = domain && domain !== "all"
    const hasSearchFilter = searchQuery && searchQuery.trim() !== ""
    const hasImagesFilter = hasImages !== undefined

    // Collecter les questions
    let questions
    if (hasDomainFilter) {
      questions = await ctx.db
        .query("questions")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .take(5000)
    } else {
      questions = await ctx.db.query("questions").take(5000)
    }

    // Appliquer les filtres
    let filtered = questions

    if (hasSearchFilter) {
      const lowerQuery = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (q) =>
          q.question.toLowerCase().includes(lowerQuery) ||
          q.objectifCMC.toLowerCase().includes(lowerQuery)
      )
    }

    if (hasImagesFilter) {
      filtered = filtered.filter((q) => {
        const questionHasImages = q.images && q.images.length > 0
        return hasImages ? questionHasImages : !questionHasImages
      })
    }

    // Retourner les données formatées pour l'export
    return filtered.map((q) => ({
      _id: q._id,
      _creationTime: q._creationTime,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      references: q.references || [],
      objectifCMC: q.objectifCMC,
      domain: q.domain,
      hasImages: (q.images && q.images.length > 0) || false,
      imagesCount: q.images?.length || 0,
    }))
  },
})


// Obtenir des questions aléatoires (optimisé pour quiz)
export const getRandomQuestions = query({
  args: {
    count: v.number(),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Limit sample size for performance: take 3x requested count or 500, whichever is larger
    // This provides good randomness without collecting entire table
    const sampleSize = Math.max(args.count * 3, 500)
    let questions

    // Use index when filtering by domain
    if (args.domain && args.domain !== "all") {
      questions = await ctx.db
        .query("questions")
        .withIndex("by_domain", (q) => q.eq("domain", args.domain!))
        .take(sampleSize)
    } else {
      questions = await ctx.db.query("questions").take(sampleSize)
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
// MUTATIONS POUR LES IMAGES
// ============================================

/**
 * Ajouter une image à une question
 */
export const addQuestionImage = mutation({
  args: {
    questionId: v.id("questions"),
    image: questionImageValidator,
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const question = await ctx.db.get(args.questionId)
    if (!question) {
      throw new Error("Question non trouvée")
    }

    const currentImages = question.images || []
    const newImages = [...currentImages, args.image].sort((a, b) => a.order - b.order)

    await ctx.db.patch(args.questionId, { images: newImages })

    return { success: true }
  },
})

/**
 * Supprimer une image d'une question
 */
export const removeQuestionImage = mutation({
  args: {
    questionId: v.id("questions"),
    storagePath: v.string(),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const question = await ctx.db.get(args.questionId)
    if (!question) {
      throw new Error("Question non trouvée")
    }

    const currentImages = question.images || []
    const imageToRemove = currentImages.find((img) => img.storagePath === args.storagePath)

    if (!imageToRemove) {
      throw new Error("Image non trouvée")
    }

    // Supprimer du storage Bunny
    await deleteFromBunny(args.storagePath)

    // Mettre à jour la question
    const newImages = currentImages
      .filter((img) => img.storagePath !== args.storagePath)
      .map((img, index) => ({ ...img, order: index }))

    await ctx.db.patch(args.questionId, { images: newImages })

    return { success: true }
  },
})

/**
 * Réordonner les images d'une question
 */
export const reorderQuestionImages = mutation({
  args: {
    questionId: v.id("questions"),
    orderedStoragePaths: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const question = await ctx.db.get(args.questionId)
    if (!question) {
      throw new Error("Question non trouvée")
    }

    const currentImages = question.images || []

    // Réordonner selon le nouvel ordre
    const reorderedImages = args.orderedStoragePaths
      .map((path, index) => {
        const image = currentImages.find((img) => img.storagePath === path)
        if (!image) return null
        return { ...image, order: index }
      })
      .filter((img): img is NonNullable<typeof img> => img !== null)

    await ctx.db.patch(args.questionId, { images: reorderedImages })

    return { success: true }
  },
})

/**
 * Mettre à jour toutes les images d'une question (utilisé lors de la création/édition)
 */
export const setQuestionImages = mutation({
  args: {
    questionId: v.id("questions"),
    images: v.array(questionImageValidator),
  },
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const question = await ctx.db.get(args.questionId)
    if (!question) {
      throw new Error("Question non trouvée")
    }

    // Identifier les images supprimées
    const currentImages = question.images || []
    const newStoragePaths = new Set(args.images.map((img) => img.storagePath))
    const imagesToDelete = currentImages.filter((img) => !newStoragePaths.has(img.storagePath))

    // Supprimer les anciennes images du storage
    await Promise.all(imagesToDelete.map((img) => deleteFromBunny(img.storagePath)))

    // Mettre à jour avec les nouvelles images
    const sortedImages = [...args.images].sort((a, b) => a.order - b.order)
    await ctx.db.patch(args.questionId, { images: sortedImages })

    return { success: true }
  },
})

// ============================================
// HELPER: Normalisation objectifCMC
// ============================================

/**
 * Normalise un objectifCMC: trim + majuscule initiale
 */
function normalizeObjectifCMC(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

// ============================================
// MIGRATION: Audit et normalisation objectifCMC
// ============================================

/**
 * Audit des valeurs objectifCMC pour identifier les doublons
 * Commande: npx convex run questions:auditObjectifsCMC
 */
export const auditObjectifsCMC = internalMutation({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db.query("questions").collect()

    // Grouper par forme normalisée (trim + lowercase)
    const groups = new Map<string, { values: Set<string>; count: number }>()

    for (const q of questions) {
      const normalized = q.objectifCMC.trim().toLowerCase()
      const existing = groups.get(normalized) || { values: new Set(), count: 0 }
      existing.values.add(q.objectifCMC)
      existing.count++
      groups.set(normalized, existing)
    }

    // Retourner toutes les valeurs groupées
    return Array.from(groups.entries()).map(([key, data]) => ({
      normalized: key,
      variants: Array.from(data.values),
      count: data.count,
      hasDuplicates: data.values.size > 1,
    })).sort((a, b) => a.normalized.localeCompare(b.normalized, "fr"))
  },
})

/**
 * Migration pour normaliser les objectifCMC
 * Commande: npx convex run questions:normalizeObjectifsCMC --args '{"mappings": [...]}'
 */
export const normalizeObjectifsCMC = internalMutation({
  args: {
    mappings: v.array(
      v.object({
        canonical: v.string(),
        variants: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let updated = 0

    for (const { canonical, variants } of args.mappings) {
      for (const variant of variants) {
        if (variant === canonical) continue // Skip si déjà correct

        const questions = await ctx.db
          .query("questions")
          .withIndex("by_objectifCMC", (q) => q.eq("objectifCMC", variant))
          .collect()

        for (const q of questions) {
          await ctx.db.patch(q._id, { objectifCMC: canonical })
          updated++
        }
      }
    }

    return { updated }
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
