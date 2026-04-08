import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { getAdminUserOrThrow } from "./lib/auth"
import {
  batchGetExplanationsByQuestionIds,
  batchGetOrderedByIds,
} from "./lib/batchFetch"
import { deleteFromBunny } from "./lib/bunny"
import { Errors } from "./lib/errors"

// ============================================
// TYPES POUR LES IMAGES
// ============================================

const questionImageValidator = v.object({
  url: v.string(),
  storagePath: v.string(),
  order: v.number(),
})

// Validator complet pour un document question
// Notes :
// - `hasImagesComputed` est optional pendant le backfill PR A.
// - PR C : `explanation` et `references` sont optional car ils ont été
//   physiquement déplacés vers `questionExplanations`. Les queries qui
//   doivent retourner l'explication (getQuestionById, _getQuestionsPageForExport,
//   scoreQuizAnswers) joignent désormais depuis questionExplanations.
//   Le validator accepte undefined pour le listing direct (getAllQuestions,
//   getQuestionsWithFilters paginated) qui ne joignent pas et ne paient
//   plus le coût des explications.
const questionDocValidator = v.object({
  _id: v.id("questions"),
  _creationTime: v.number(),
  question: v.string(),
  images: v.optional(v.array(questionImageValidator)),
  options: v.array(v.string()),
  correctAnswer: v.string(),
  explanation: v.optional(v.string()),
  references: v.optional(v.array(v.string())),
  objectifCMC: v.string(),
  domain: v.string(),
  hasImagesComputed: v.optional(v.boolean()),
})

// Validator pour question sans réponses (quiz marketing)
const questionWithoutAnswersValidator = v.object({
  _id: v.id("questions"),
  _creationTime: v.number(),
  question: v.string(),
  images: v.optional(v.array(questionImageValidator)),
  options: v.array(v.string()),
  references: v.optional(v.array(v.string())),
  objectifCMC: v.string(),
  domain: v.string(),
  hasImagesComputed: v.optional(v.boolean()),
})

// Validator pour résultat paginé de questions
const paginatedQuestionsValidator = v.object({
  page: v.array(questionDocValidator),
  continueCursor: v.string(),
  isDone: v.boolean(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(
    v.union(
      v.literal("SplitRecommended"),
      v.literal("SplitRequired"),
      v.null(),
    ),
  ),
})

// ============================================
// HELPERS POUR LA GESTION DES STATS
// ============================================

const TOTAL_DOMAIN_KEY = "__total__"

// Validation: empêcher l'utilisation de la clé réservée comme nom de domaine
const validateDomain = (domain: string) => {
  if (domain === TOTAL_DOMAIN_KEY) {
    throw Errors.invalidInput(`Le domaine "${TOTAL_DOMAIN_KEY}" est réservé`)
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
    console.warn(
      `[questionStats] Domaine "${domain}" introuvable lors du décrement`,
    )
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
    console.warn(
      `[questionStats] Ancien domaine "${oldDomain}" introuvable lors du transfert`,
    )
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
// HELPERS POUR LES STATS OBJECTIFS CMC
// ============================================

const GLOBAL_OBJECTIF_KEY = "__all__"

// Helper: Incrémenter le compteur d'un objectifCMC (domaine-specific + global)
const incrementObjectifCMCCount = async (
  ctx: MutationCtx,
  objectifCMC: string,
  domain: string,
) => {
  const normalized = normalizeObjectifCMC(objectifCMC)
  if (!normalized) return

  // Incrémenter la ligne (objectifCMC, domain)
  const domainStat = await ctx.db
    .query("objectifCMCStats")
    .withIndex("by_objectifCMC_domain", (q) =>
      q.eq("objectifCMC", normalized).eq("domain", domain),
    )
    .unique()

  if (domainStat) {
    await ctx.db.patch(domainStat._id, { count: domainStat.count + 1 })
  } else {
    await ctx.db.insert("objectifCMCStats", {
      objectifCMC: normalized,
      domain,
      count: 1,
    })
  }

  // Incrémenter la ligne globale (objectifCMC, "__all__")
  const globalStat = await ctx.db
    .query("objectifCMCStats")
    .withIndex("by_objectifCMC_domain", (q) =>
      q.eq("objectifCMC", normalized).eq("domain", GLOBAL_OBJECTIF_KEY),
    )
    .unique()

  if (globalStat) {
    await ctx.db.patch(globalStat._id, { count: globalStat.count + 1 })
  } else {
    await ctx.db.insert("objectifCMCStats", {
      objectifCMC: normalized,
      domain: GLOBAL_OBJECTIF_KEY,
      count: 1,
    })
  }
}

// Helper: Décrémenter le compteur d'un objectifCMC (domaine-specific + global)
const decrementObjectifCMCCount = async (
  ctx: MutationCtx,
  objectifCMC: string,
  domain: string,
) => {
  const normalized = normalizeObjectifCMC(objectifCMC)
  if (!normalized) return

  // Décrémenter la ligne (objectifCMC, domain)
  const domainStat = await ctx.db
    .query("objectifCMCStats")
    .withIndex("by_objectifCMC_domain", (q) =>
      q.eq("objectifCMC", normalized).eq("domain", domain),
    )
    .unique()

  if (domainStat) {
    if (domainStat.count <= 1) {
      await ctx.db.delete(domainStat._id)
    } else {
      await ctx.db.patch(domainStat._id, { count: domainStat.count - 1 })
    }
  } else {
    console.warn(
      `[objectifCMCStats] Stat "${normalized}" / "${domain}" introuvable lors du décrement`,
    )
  }

  // Décrémenter la ligne globale
  const globalStat = await ctx.db
    .query("objectifCMCStats")
    .withIndex("by_objectifCMC_domain", (q) =>
      q.eq("objectifCMC", normalized).eq("domain", GLOBAL_OBJECTIF_KEY),
    )
    .unique()

  if (globalStat) {
    if (globalStat.count <= 1) {
      await ctx.db.delete(globalStat._id)
    } else {
      await ctx.db.patch(globalStat._id, { count: globalStat.count - 1 })
    }
  }
}

// Helper: Transférer le compteur objectifCMC quand objectifCMC et/ou domain changent
const transferObjectifCMCCount = async (
  ctx: MutationCtx,
  oldObjectif: string,
  newObjectif: string,
  oldDomain: string,
  newDomain: string,
) => {
  const oldNorm = normalizeObjectifCMC(oldObjectif)
  const newNorm = normalizeObjectifCMC(newObjectif)

  if (oldNorm === newNorm && oldDomain === newDomain) return

  if (oldNorm) {
    await decrementObjectifCMCCount(ctx, oldNorm, oldDomain)
  }
  if (newNorm) {
    await incrementObjectifCMCCount(ctx, newNorm, newDomain)
  }
}

// ============================================
// HELPERS POUR LE COMPTEUR D'IMAGES
// ============================================

const incrementWithImagesCount = async (ctx: MutationCtx) => {
  const totalStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
    .unique()

  if (totalStat) {
    await ctx.db.patch(totalStat._id, {
      withImagesCount: (totalStat.withImagesCount ?? 0) + 1,
    })
  }
}

const decrementWithImagesCount = async (ctx: MutationCtx) => {
  const totalStat = await ctx.db
    .query("questionStats")
    .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
    .unique()

  if (totalStat && (totalStat.withImagesCount ?? 0) > 0) {
    await ctx.db.patch(totalStat._id, {
      withImagesCount: (totalStat.withImagesCount ?? 0) - 1,
    })
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
  returns: v.id("questions"),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Normaliser l'objectifCMC (trim + majuscule initiale)
    const normalizedObjectif = normalizeObjectifCMC(args.objectifCMC)

    // PR C (cutover) : on n'écrit plus `explanation` / `references` dans la
    // table `questions`. Ces champs vivent exclusivement dans `questionExplanations`.
    const questionId = await ctx.db.insert("questions", {
      question: args.question,
      options: args.options,
      correctAnswer: args.correctAnswer,
      objectifCMC: normalizedObjectif,
      domain: args.domain,
      // hasImagesComputed alimente le searchIndex (filterField).
      // false au create car aucune image n'est jamais passée dans createQuestion.
      hasImagesComputed: false,
    })

    // Source de vérité pour explanation/references. Atomique avec l'insert
    // ci-dessus grâce aux mutations Convex transactionnelles.
    await ctx.db.insert("questionExplanations", {
      questionId,
      explanation: args.explanation,
      references: args.references,
    })

    // Mettre à jour les stats d'agrégation
    await incrementDomainCount(ctx, args.domain)
    await incrementObjectifCMCCount(ctx, normalizedObjectif, args.domain)

    return questionId
  },
})

// Récupérer toutes les questions (limité pour performance)
// Note: Use getQuestionsWithPagination for large datasets
export const getAllQuestions = query({
  args: {},
  returns: v.array(questionDocValidator),
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)
    // Limit to 1000 questions to prevent unbounded reads
    // For full list, use paginated query
    return await ctx.db.query("questions").order("desc").take(1000)
  },
})

// Récupérer tous les IDs de questions (pour auto-complete efficace)
export const getAllQuestionIds = query({
  args: {},
  returns: v.array(v.id("questions")),
  handler: async (ctx) => {
    await getAdminUserOrThrow(ctx)

    const questions = await ctx.db.query("questions").take(5000)
    return questions.map((q) => q._id)
  },
})

// Récupérer les statistiques des questions pour le dashboard admin (optimisé via table d'agrégation)
export const getQuestionStats = query({
  args: {},
  returns: v.object({
    totalCount: v.number(),
    domainStats: v.array(v.object({ domain: v.string(), count: v.number() })),
  }),
  handler: async (ctx) => {
    // Lire depuis la table d'agrégation (beaucoup plus efficace que full scan)
    const allStats = await ctx.db.query("questionStats").take(1000)

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
  returns: v.object({
    totalCount: v.number(),
    withImagesCount: v.number(),
    withoutImagesCount: v.number(),
    uniqueDomainsCount: v.number(),
    domainStats: v.array(v.object({ domain: v.string(), count: v.number() })),
  }),
  handler: async (ctx) => {
    // Lire depuis la table d'agrégation (plus de scan de la table questions)
    const allStats = await ctx.db.query("questionStats").take(1000)

    const totalStat = allStats.find((s) => s.domain === TOTAL_DOMAIN_KEY)
    const domainStats = allStats
      .filter((s) => s.domain !== TOTAL_DOMAIN_KEY)
      .map((s) => ({ domain: s.domain, count: s.count }))
      .sort((a, b) => b.count - a.count)

    const totalCount = totalStat?.count ?? 0
    const withImagesCount = totalStat?.withImagesCount ?? 0

    return {
      totalCount,
      withImagesCount,
      withoutImagesCount: totalCount - withImagesCount,
      uniqueDomainsCount: domainStats.length,
      domainStats,
    }
  },
})

// Supprimer une question (admin seulement)
export const deleteQuestion = mutation({
  args: { id: v.id("questions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    // Récupérer la question pour connaître son domaine
    const question = await ctx.db.get(args.id)
    if (!question) {
      throw Errors.notFound("Question")
    }

    // Dual-delete (M1) : supprimer d'abord la ligne questionExplanations
    // associée si elle existe (peut ne pas exister si pas encore backfillée).
    // Atomique : les deux deletes sont dans la même mutation.
    const explanationRow = await ctx.db
      .query("questionExplanations")
      .withIndex("by_question", (q) => q.eq("questionId", args.id))
      .unique()
    if (explanationRow) {
      await ctx.db.delete(explanationRow._id)
    }

    await ctx.db.delete(args.id)

    // Mettre à jour les stats d'agrégation
    await decrementDomainCount(ctx, question.domain)
    await decrementObjectifCMCCount(ctx, question.objectifCMC, question.domain)
    if (question.images && question.images.length > 0) {
      await decrementWithImagesCount(ctx)
    }
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
  returns: v.null(),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const { id, ...updateData } = args

    // Récupérer la question existante pour vérifier le changement de domaine
    const existingQuestion = await ctx.db.get(id)
    if (!existingQuestion) {
      throw Errors.notFound("Question")
    }

    // Normaliser l'objectifCMC si fourni
    if (updateData.objectifCMC !== undefined) {
      updateData.objectifCMC = normalizeObjectifCMC(updateData.objectifCMC)
    }

    // PR C (cutover) : `explanation` / `references` ne sont plus écrits dans
    // la table `questions`. On les extrait du patch appliqué à `questions`
    // (ils sont gérés séparément ci-dessous sur `questionExplanations`).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { explanation, references, ...questionPatch } = updateData

    // Filtrer les valeurs undefined
    const filteredData = Object.fromEntries(
      Object.entries(questionPatch).filter(([, value]) => value !== undefined),
    )

    if (Object.keys(filteredData).length > 0) {
      await ctx.db.patch(id, filteredData)
    }

    // Source de vérité : maintenir la cohérence avec questionExplanations
    // si explanation ou references est dans le patch.
    if (
      updateData.explanation !== undefined ||
      updateData.references !== undefined
    ) {
      const existingExplanationRow = await ctx.db
        .query("questionExplanations")
        .withIndex("by_question", (q) => q.eq("questionId", id))
        .unique()

      if (existingExplanationRow) {
        // Patch ciblé : ne mettre à jour que les champs fournis
        const explanationPatch: {
          explanation?: string
          references?: string[]
        } = {}
        if (updateData.explanation !== undefined) {
          explanationPatch.explanation = updateData.explanation
        }
        if (updateData.references !== undefined) {
          explanationPatch.references = updateData.references
        }
        await ctx.db.patch(existingExplanationRow._id, explanationPatch)
      } else {
        // Defensive safety net : toute question devrait avoir une ligne
        // questionExplanations (invariant vérifié en M2 avant PR C). Ce chemin
        // ne doit plus être emprunté en temps normal, mais on tolère et on
        // recrée la ligne plutôt que d'échouer silencieusement. Fallback sur
        // l'ancien champ `existingQuestion.explanation` (peut être undefined
        // après le cleanup) → empty string si absent.
        await ctx.db.insert("questionExplanations", {
          questionId: id,
          explanation:
            updateData.explanation ?? existingQuestion.explanation ?? "",
          references: updateData.references ?? existingQuestion.references,
        })
      }
    }

    // Si le domaine a changé, mettre à jour les stats domaine
    if (args.domain !== undefined && args.domain !== existingQuestion.domain) {
      await transferDomainCount(ctx, existingQuestion.domain, args.domain)
    }

    // Si l'objectifCMC ou le domaine a changé, mettre à jour les stats objectifCMC
    const effectiveNewObjectif =
      updateData.objectifCMC ?? existingQuestion.objectifCMC
    const effectiveNewDomain = args.domain ?? existingQuestion.domain
    if (
      existingQuestion.objectifCMC !== effectiveNewObjectif ||
      existingQuestion.domain !== effectiveNewDomain
    ) {
      await transferObjectifCMCCount(
        ctx,
        existingQuestion.objectifCMC,
        effectiveNewObjectif,
        existingQuestion.domain,
        effectiveNewDomain,
      )
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
  returns: paginatedQuestionsValidator,
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)
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
      const allQuestions = await baseQuery.take(5000)

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

// Version améliorée avec filtres avancés.
//
// PR A : réécriture complète pour éliminer le .take(5000) + filtre JS qui
// consommait ~723 MB/mois de bandwidth. Le chemin chaud utilise maintenant
// le searchIndex Convex `search_question` quand il y a une recherche texte,
// et les index natifs `by_domain` + `by_creation_time` sinon.
//
// Changements de comportement :
// - Le tri custom par `question`/`domain`/`objectifCMC` est retiré. Quand
//   il y a une recherche, Convex trie par pertinence. Sans recherche, on
//   trie par `_creationTime` (index natif). L'argument `sortBy` est
//   accepté mais ignoré pour les valeurs autres que `_creationTime` afin
//   de rester rétro-compatible avec les clients existants.
// - Le filtre `hasImages` utilise désormais le champ dénormalisé
//   `hasImagesComputed` (filterField du searchIndex ou égalité sur index).
//   Les questions non backfillées (hasImagesComputed === undefined)
//   matcheront `hasImages: false` si on demande "sans images" — cohérent
//   avec la sémantique précédente qui regardait `images === undefined`.
export const getQuestionsWithFilters = query({
  args: {
    paginationOpts: paginationOptsValidator,
    searchQuery: v.optional(v.string()),
    domain: v.optional(v.string()),
    hasImages: v.optional(v.boolean()),
    // Conservés pour compat client — ignorés sauf "_creationTime".
    sortBy: v.optional(
      v.union(
        v.literal("_creationTime"),
        v.literal("question"),
        v.literal("domain"),
        v.literal("objectifCMC"),
      ),
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: paginatedQuestionsValidator,
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)
    const {
      paginationOpts,
      searchQuery,
      domain,
      hasImages,
      sortOrder = "desc",
    } = args

    const hasDomainFilter = domain !== undefined && domain !== "all"
    const hasSearchFilter =
      searchQuery !== undefined && searchQuery.trim() !== ""
    const hasImagesFilter = hasImages !== undefined

    // ========================================
    // Chemin 1 : recherche texte (searchIndex)
    // ========================================
    // Convex searchIndex borne naturellement les résultats (~256 max)
    // et retourne déjà triés par pertinence. C'est la voie la plus
    // efficace et celle qui tuait historiquement le bandwidth.
    if (hasSearchFilter) {
      const trimmedQuery = searchQuery.trim()
      return await ctx.db
        .query("questions")
        .withSearchIndex("search_question", (q) => {
          let builder = q.search("question", trimmedQuery)
          if (hasDomainFilter) {
            builder = builder.eq("domain", domain)
          }
          if (hasImagesFilter) {
            builder = builder.eq("hasImagesComputed", hasImages)
          }
          return builder
        })
        .paginate(paginationOpts)
    }

    // ========================================
    // Chemin 2 : filtre hasImages (index natif impossible, filter léger)
    // ========================================
    // Pas d'index sur `hasImagesComputed` seul — on utilise withIndex sur
    // `by_domain` si dispo, sinon parcours ordonné de la table, avec un
    // filter sur `hasImagesComputed`. Convex `.filter()` + `.paginate()`
    // lit une page à la fois (pas de collecte), donc le bandwidth reste
    // borné par la taille de la page.
    if (hasImagesFilter) {
      const order = sortOrder === "desc" ? "desc" : "asc"
      if (hasDomainFilter) {
        return await ctx.db
          .query("questions")
          .withIndex("by_domain", (q) => q.eq("domain", domain))
          .order(order)
          .filter((q) => q.eq(q.field("hasImagesComputed"), hasImages))
          .paginate(paginationOpts)
      }
      return await ctx.db
        .query("questions")
        .order(order)
        .filter((q) => q.eq(q.field("hasImagesComputed"), hasImages))
        .paginate(paginationOpts)
    }

    // ========================================
    // Chemin 3 : pagination native (sans filtre texte ni hasImages)
    // ========================================
    const order = sortOrder === "desc" ? "desc" : "asc"

    if (hasDomainFilter) {
      return await ctx.db
        .query("questions")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .order(order)
        .paginate(paginationOpts)
    }

    return await ctx.db.query("questions").order(order).paginate(paginationOpts)
  },
})

// Récupérer une question par son ID (pour le panel et l'édition)
// PR B : l'explanation/references viennent désormais de questionExplanations
// (jointure transparente côté serveur). Le shape de retour est inchangé
// pour garder la compatibilité avec le frontend.
export const getQuestionById = query({
  args: { questionId: v.id("questions") },
  returns: v.union(v.null(), questionDocValidator),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const question = await ctx.db.get(args.questionId)
    if (!question) return null

    const explanationRow = await ctx.db
      .query("questionExplanations")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .unique()

    // Merge : les valeurs de questionExplanations prennent la priorité.
    // Fallback sur les anciens champs de questions (dual-write M1 actif).
    return {
      ...question,
      explanation: explanationRow?.explanation ?? question.explanation ?? "",
      references: explanationRow?.references ?? question.references,
    }
  },
})

// Récupérer tous les objectifs CMC uniques (pour le combobox)
// Optimisé : lit depuis la table d'agrégation objectifCMCStats au lieu de scanner 5000+ questions
export const getUniqueObjectifsCMC = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    // Lire les lignes globales (__all__) depuis objectifCMCStats
    const stats = await ctx.db
      .query("objectifCMCStats")
      .withIndex("by_domain", (q) => q.eq("domain", GLOBAL_OBJECTIF_KEY))
      .take(1000)

    return stats
      .map((s) => s.objectifCMC)
      .sort((a, b) => a.localeCompare(b, "fr"))
  },
})

// Query paginée interne pour l'export (appelée par l'action getAllQuestionsForExport)
export const _getQuestionsPageForExport = internalQuery({
  args: {
    searchQuery: v.optional(v.string()),
    domain: v.optional(v.string()),
    hasImages: v.optional(v.boolean()),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("questions"),
        _creationTime: v.number(),
        question: v.string(),
        options: v.array(v.string()),
        correctAnswer: v.string(),
        explanation: v.string(),
        references: v.array(v.string()),
        objectifCMC: v.string(),
        domain: v.string(),
        hasImages: v.boolean(),
        imagesCount: v.number(),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { searchQuery, domain, hasImages, paginationOpts } = args
    const hasDomainFilter = domain && domain !== "all"
    const hasSearchFilter = searchQuery && searchQuery.trim() !== ""
    const hasImagesFilter = hasImages !== undefined
    const needsJsFilter = hasSearchFilter || hasImagesFilter

    if (!needsJsFilter) {
      // Pagination native Convex (pas de filtre JS nécessaire)
      let result
      if (hasDomainFilter) {
        result = await ctx.db
          .query("questions")
          .withIndex("by_domain", (q) => q.eq("domain", domain))
          .paginate(paginationOpts)
      } else {
        result = await ctx.db.query("questions").paginate(paginationOpts)
      }

      // PR B : jointure depuis questionExplanations
      const explanationsMap = await batchGetExplanationsByQuestionIds(
        ctx,
        result.page.map((q) => q._id),
      )

      return {
        page: result.page.map((q) => {
          const joined = explanationsMap.get(q._id)
          return {
            _id: q._id,
            _creationTime: q._creationTime,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: joined?.explanation ?? q.explanation ?? "",
            references: joined?.references ?? q.references ?? [],
            objectifCMC: q.objectifCMC,
            domain: q.domain,
            hasImages: (q.images && q.images.length > 0) || false,
            imagesCount: q.images?.length || 0,
          }
        }),
        continueCursor: result.continueCursor,
        isDone: result.isDone,
      }
    }

    // Avec filtres JS : pagination offset-based
    const startOffset = paginationOpts.cursor
      ? parseInt(paginationOpts.cursor, 10)
      : 0
    const batchSize = 1000

    let questions
    if (hasDomainFilter) {
      questions = await ctx.db
        .query("questions")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .take(startOffset + batchSize)
    } else {
      questions = await ctx.db.query("questions").take(startOffset + batchSize)
    }

    let batch = questions.slice(startOffset)

    if (hasSearchFilter) {
      const lowerQuery = searchQuery.toLowerCase()
      batch = batch.filter(
        (q) =>
          q.question.toLowerCase().includes(lowerQuery) ||
          q.objectifCMC.toLowerCase().includes(lowerQuery),
      )
    }

    if (hasImagesFilter) {
      batch = batch.filter((q) => {
        const questionHasImages = q.images && q.images.length > 0
        return hasImages ? questionHasImages : !questionHasImages
      })
    }

    const page = batch.slice(0, paginationOpts.numItems)
    const isDone = questions.length < startOffset + batchSize

    // PR B : jointure depuis questionExplanations
    const explanationsMap = await batchGetExplanationsByQuestionIds(
      ctx,
      page.map((q) => q._id),
    )

    return {
      page: page.map((q) => {
        const joined = explanationsMap.get(q._id)
        return {
          _id: q._id,
          _creationTime: q._creationTime,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: joined?.explanation ?? q.explanation ?? "",
          references: joined?.references ?? q.references ?? [],
          objectifCMC: q.objectifCMC,
          domain: q.domain,
          hasImages: (q.images && q.images.length > 0) || false,
          imagesCount: q.images?.length || 0,
        }
      }),
      continueCursor: isDone ? "" : (startOffset + batchSize).toString(),
      isDone,
    }
  },
})

// Exporter toutes les questions (action non-réactive, évite la souscription pour gros volumes)
export const getAllQuestionsForExport = action({
  args: {
    searchQuery: v.optional(v.string()),
    domain: v.optional(v.string()),
    hasImages: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("questions"),
      _creationTime: v.number(),
      question: v.string(),
      options: v.array(v.string()),
      correctAnswer: v.string(),
      explanation: v.string(),
      references: v.array(v.string()),
      objectifCMC: v.string(),
      domain: v.string(),
      hasImages: v.boolean(),
      imagesCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Vérifier l'authentification admin
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw Errors.unauthenticated()
    const user = await ctx.runQuery(internal.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })
    if (!user || user.role !== "admin") throw Errors.unauthorized()

    // Boucle paginée pour récupérer toutes les questions
    type ExportQuestion = {
      _id: Id<"questions">
      _creationTime: number
      question: string
      options: string[]
      correctAnswer: string
      explanation: string
      references: string[]
      objectifCMC: string
      domain: string
      hasImages: boolean
      imagesCount: number
    }
    const allResults: ExportQuestion[] = []

    let cursor: string | null = null
    let done = false

    while (!done) {
      const page = (await ctx.runQuery(
        internal.questions._getQuestionsPageForExport,
        {
          searchQuery: args.searchQuery,
          domain: args.domain,
          hasImages: args.hasImages,
          paginationOpts: { numItems: 500, cursor },
        },
      )) as {
        page: ExportQuestion[]
        continueCursor: string
        isDone: boolean
      }

      allResults.push(...page.page)
      done = page.isDone
      cursor = page.isDone ? null : page.continueCursor
    }

    return allResults
  },
})

// Obtenir des questions aléatoires (optimisé pour quiz marketing)
// Mutation car utilise Math.random() (non déterministe, interdit dans les queries)
// Masque correctAnswer et explanation pour le quiz public
export const getRandomQuestions = mutation({
  args: {
    count: v.number(),
    domain: v.optional(v.string()),
  },
  returns: v.array(questionWithoutAnswersValidator),
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

    // Retourner sans correctAnswer ni explanation (quiz public)
    return shuffled.slice(0, Math.min(args.count, shuffled.length)).map((q) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { correctAnswer, explanation, ...rest } = q
      return rest
    })
  },
})

/**
 * Score quiz answers server-side and return per-question results for review.
 * Used by the public marketing quiz after completion.
 * Returns only scoring data (isCorrect, correctAnswer, explanation) — not full question docs.
 * The frontend merges this with the questions already in state from getRandomQuestions.
 */
export const scoreQuizAnswers = mutation({
  args: {
    answers: v.array(
      v.object({
        questionId: v.id("questions"),
        selectedAnswer: v.union(v.string(), v.null()),
      }),
    ),
  },
  returns: v.object({
    score: v.number(),
    totalQuestions: v.number(),
    questionResults: v.array(
      v.object({
        questionId: v.id("questions"),
        isCorrect: v.boolean(),
        correctAnswer: v.string(),
        explanation: v.string(),
        references: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const questionIds = args.answers.map((a) => a.questionId)
    const questions = await batchGetOrderedByIds(ctx, "questions", questionIds)

    // PR B : jointure depuis questionExplanations pour éviter de dépendre
    // des champs legacy explanation/references dans questions.
    const explanationsMap = await batchGetExplanationsByQuestionIds(
      ctx,
      questionIds,
    )

    let score = 0
    const questionResults = []

    for (let i = 0; i < args.answers.length; i++) {
      const question = questions[i]
      if (!question) continue

      const isCorrect =
        args.answers[i].selectedAnswer === question.correctAnswer
      if (isCorrect) score++

      const joined = explanationsMap.get(question._id)
      questionResults.push({
        questionId: question._id,
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: joined?.explanation ?? question.explanation ?? "",
        references: joined?.references ?? question.references ?? [],
      })
    }

    return {
      score,
      totalQuestions: questionResults.length,
      questionResults,
    }
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
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const question = await ctx.db.get(args.questionId)
    if (!question) {
      throw Errors.notFound("Question")
    }

    const currentImages = question.images || []
    const newImages = [...currentImages, args.image].sort(
      (a, b) => a.order - b.order,
    )

    await ctx.db.patch(args.questionId, {
      images: newImages,
      hasImagesComputed: true,
    })

    // Si c'est la première image ajoutée (0 → 1), incrémenter withImagesCount
    if (currentImages.length === 0) {
      await incrementWithImagesCount(ctx)
    }

    return { success: true }
  },
})

/**
 * Supprimer une image d'une question (internalMutation pour la partie DB)
 */
export const _removeQuestionImageData = internalMutation({
  args: {
    questionId: v.id("questions"),
    storagePath: v.string(),
  },
  returns: v.object({ storagePath: v.string() }),
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.questionId)
    if (!question) {
      throw new Error("Question non trouvée")
    }

    const currentImages = question.images || []
    const imageToRemove = currentImages.find(
      (img) => img.storagePath === args.storagePath,
    )

    if (!imageToRemove) {
      throw new Error("Image non trouvée")
    }

    const newImages = currentImages
      .filter((img) => img.storagePath !== args.storagePath)
      .map((img, index) => ({ ...img, order: index }))

    await ctx.db.patch(args.questionId, {
      images: newImages,
      hasImagesComputed: newImages.length > 0,
    })

    // Si la dernière image a été supprimée (1 → 0), décrémenter withImagesCount
    if (newImages.length === 0 && currentImages.length > 0) {
      await decrementWithImagesCount(ctx)
    }

    return { storagePath: args.storagePath }
  },
})

/**
 * Supprimer une image d'une question (action: DB + suppression Bunny)
 */
export const removeQuestionImage = action({
  args: {
    questionId: v.id("questions"),
    storagePath: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // Vérifier l'authentification admin
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw Errors.unauthenticated()
    const user = await ctx.runQuery(internal.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })
    if (!user || user.role !== "admin") throw Errors.unauthorized()

    // Supprimer l'image de la DB
    const result = await ctx.runMutation(
      internal.questions._removeQuestionImageData,
      { questionId: args.questionId, storagePath: args.storagePath },
    )

    // Supprimer du storage Bunny
    await deleteFromBunny(result.storagePath)

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
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await getAdminUserOrThrow(ctx)

    const question = await ctx.db.get(args.questionId)
    if (!question) {
      throw Errors.notFound("Question")
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
 * Mettre à jour toutes les images d'une question (internalMutation pour la partie DB)
 * Retourne les storagePaths des images supprimées pour nettoyage Bunny
 */
export const _setQuestionImagesData = internalMutation({
  args: {
    questionId: v.id("questions"),
    images: v.array(questionImageValidator),
  },
  returns: v.object({ pathsToDelete: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.questionId)
    if (!question) {
      throw new Error("Question non trouvée")
    }

    // Identifier les images supprimées
    const currentImages = question.images || []
    const newStoragePaths = new Set(args.images.map((img) => img.storagePath))
    const pathsToDelete = currentImages
      .filter((img) => !newStoragePaths.has(img.storagePath))
      .map((img) => img.storagePath)

    // Mettre à jour avec les nouvelles images
    const sortedImages = [...args.images].sort((a, b) => a.order - b.order)
    const hasImagesNow = sortedImages.length > 0
    await ctx.db.patch(args.questionId, {
      images: sortedImages,
      hasImagesComputed: hasImagesNow,
    })

    // Mettre à jour withImagesCount si le statut images a changé
    const hadImages = currentImages.length > 0
    if (!hadImages && hasImagesNow) {
      await incrementWithImagesCount(ctx)
    } else if (hadImages && !hasImagesNow) {
      await decrementWithImagesCount(ctx)
    }

    return { pathsToDelete }
  },
})

/**
 * Mettre à jour toutes les images d'une question (action: DB + suppression Bunny)
 */
export const setQuestionImages = action({
  args: {
    questionId: v.id("questions"),
    images: v.array(questionImageValidator),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // Vérifier l'authentification admin
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw Errors.unauthenticated()
    const user = await ctx.runQuery(internal.users.getUserByTokenIdentifier, {
      tokenIdentifier: identity.tokenIdentifier,
    })
    if (!user || user.role !== "admin") throw Errors.unauthorized()

    // Mettre à jour la DB et récupérer les chemins à supprimer
    const { pathsToDelete } = await ctx.runMutation(
      internal.questions._setQuestionImagesData,
      { questionId: args.questionId, images: args.images },
    )

    // Supprimer les anciennes images du storage Bunny
    await Promise.all(
      pathsToDelete.map((path: string) => deleteFromBunny(path)),
    )

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
// MIGRATION: Backfill objectifCMCStats + withImagesCount
// ============================================

/**
 * Migration one-shot: Peuple objectifCMCStats et withImagesCount sur questionStats.__total__
 * Exécuter via: npx convex run questions:migrateAggregationStats
 * Idempotent: safe à relancer (clear + rebuild)
 */
export const migrateAggregationStats = internalMutation({
  args: {},
  returns: v.object({
    questionsProcessed: v.number(),
    objectifCMCStatsCreated: v.number(),
    withImagesCount: v.number(),
  }),
  handler: async (ctx) => {
    // 1. Clear objectifCMCStats existants (pour idempotence)
    const existingStats = await ctx.db.query("objectifCMCStats").take(10000)
    for (const stat of existingStats) {
      await ctx.db.delete(stat._id)
    }

    // 2. Scanner toutes les questions
    const questions = await ctx.db.query("questions").take(10000)

    // 3. Construire les maps d'agrégation en mémoire
    const domainPairCounts = new Map<string, Map<string, number>>()
    const globalCounts = new Map<string, number>()
    let withImagesCount = 0

    for (const q of questions) {
      // Compteur d'images
      if (q.images && q.images.length > 0) {
        withImagesCount++
      }

      // Compteur objectifCMC
      const objectif = normalizeObjectifCMC(q.objectifCMC)
      if (!objectif) continue

      // Pair (objectifCMC, domain)
      if (!domainPairCounts.has(objectif)) {
        domainPairCounts.set(objectif, new Map())
      }
      const domainMap = domainPairCounts.get(objectif)!
      domainMap.set(q.domain, (domainMap.get(q.domain) ?? 0) + 1)

      // Global
      globalCounts.set(objectif, (globalCounts.get(objectif) ?? 0) + 1)
    }

    // 4. Insérer les lignes objectifCMCStats
    let objectifCMCStatsCreated = 0

    // Lignes par domaine
    for (const [objectifCMC, domainMap] of domainPairCounts) {
      for (const [domain, count] of domainMap) {
        await ctx.db.insert("objectifCMCStats", { objectifCMC, domain, count })
        objectifCMCStatsCreated++
      }
    }

    // Lignes globales (__all__)
    for (const [objectifCMC, count] of globalCounts) {
      await ctx.db.insert("objectifCMCStats", {
        objectifCMC,
        domain: GLOBAL_OBJECTIF_KEY,
        count,
      })
      objectifCMCStatsCreated++
    }

    // 5. Mettre à jour withImagesCount sur questionStats.__total__
    const totalStat = await ctx.db
      .query("questionStats")
      .withIndex("by_domain", (q) => q.eq("domain", TOTAL_DOMAIN_KEY))
      .unique()

    if (totalStat) {
      await ctx.db.patch(totalStat._id, { withImagesCount })
    } else {
      await ctx.db.insert("questionStats", {
        domain: TOTAL_DOMAIN_KEY,
        count: questions.length,
        withImagesCount,
      })
    }

    console.log(
      `[Migration] ${questions.length} questions traitées, ${objectifCMCStatsCreated} stats objectifCMC créées, ${withImagesCount} questions avec images`,
    )

    return {
      questionsProcessed: questions.length,
      objectifCMCStatsCreated,
      withImagesCount,
    }
  },
})
