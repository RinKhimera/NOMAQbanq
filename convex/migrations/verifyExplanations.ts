import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { internalAction, internalQuery } from "../_generated/server"

/**
 * Migration M2 — Vérification de l'invariant questions ↔ questionExplanations.
 *
 * Scanne les deux tables et confirme que **pour chaque question, il existe
 * exactement une ligne questionExplanations correspondante**, et qu'aucune
 * ligne questionExplanations n'est orpheline.
 *
 * **Architecture (refactor M2.4)** : la vérification est exposée comme un
 * `internalAction` qui orchestre des `internalQuery` paginées. C'est nécessaire
 * parce qu'une query unique scannant les deux tables atteint vite la limite
 * Convex de 16 MB de lecture par fonction (5000+ questions × ~1.6 KB chacune
 * dépasse le seuil). En batchant via une action, chaque internalQuery a son
 * propre budget de 16 MB, donc on peut traiter une base de n'importe quelle
 * taille.
 *
 * Dashboard : Functions → migrations/verifyExplanations → verifyExplanationsInvariant
 *   Args (optionnels) : { "batchSize": 500 }
 *
 * Si `isValid: false` après exécution, **NE PAS PROCÉDER au cutover M4**.
 * Investiguer les listes d'IDs retournées (max 100 par catégorie) :
 * - `missingExplanations` : questions sans questionExplanations → relancer le backfill
 * - `orphanedExplanations` : questionExplanations sans question → cleanup manuel
 * - `duplicateQuestionIds` : questions avec >1 questionExplanations → investiguer la cause
 */

const DEFAULT_BATCH_SIZE = 500
const MAX_ISSUES_REPORTED = 100
// Garde-fou contre une boucle infinie en cas de bug de pagination Convex.
// Avec batchSize=500, supporte jusqu'à 500 000 documents par table.
const MAX_BATCHES = 1000

// ============================================================
// Workers paginés (chaque appel respecte la limite 16 MB)
// ============================================================

/**
 * Lit une page de la table `questions` et retourne uniquement les IDs.
 * Note : Convex n'a pas de projection — la lecture paye le coût des champs
 * lourds (`explanation` notamment) tant qu'ils existent dans le document.
 * C'est tolérable ici parce que chaque batch reste sous la limite par-fonction.
 */
export const _listQuestionIdsPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(v.id("questions")),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("questions").paginate(args.paginationOpts)
    return {
      page: result.page.map((q) => q._id),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    }
  },
})

/**
 * Lit une page de la table `questionExplanations` et retourne uniquement
 * les couples `(_id, questionId)` nécessaires à la vérification.
 */
export const _listExplanationKeysPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("questionExplanations"),
        questionId: v.id("questions"),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("questionExplanations")
      .paginate(args.paginationOpts)
    return {
      page: result.page.map((e) => ({ _id: e._id, questionId: e.questionId })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    }
  },
})

// ============================================================
// Action orchestratrice
// ============================================================

export const verifyExplanationsInvariant = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    questionsCount: v.number(),
    explanationsCount: v.number(),
    isValid: v.boolean(),
    truncated: v.boolean(),
    issues: v.object({
      missingExplanationsCount: v.number(),
      orphanedExplanationsCount: v.number(),
      duplicateExplanationsCount: v.number(),
      missingExplanations: v.array(v.id("questions")),
      orphanedExplanations: v.array(v.id("questionExplanations")),
      duplicateQuestionIds: v.array(v.id("questions")),
    }),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE

    // ============================================
    // Phase 1 : collecter tous les IDs de questions
    // ============================================
    const allQuestionIds = new Set<Id<"questions">>()
    let cursor: string | null = null
    let batches = 0
    let truncated = false

    while (true) {
      if (batches >= MAX_BATCHES) {
        truncated = true
        break
      }
      // Type assertion : Convex ne peut pas inférer le type de retour quand
      // la query est dans le même fichier que l'action qui l'appelle (cycle).
      const result = (await ctx.runQuery(
        internal.migrations.verifyExplanations._listQuestionIdsPage,
        { paginationOpts: { numItems: batchSize, cursor } },
      )) as {
        page: Id<"questions">[]
        continueCursor: string
        isDone: boolean
      }
      for (const id of result.page) {
        allQuestionIds.add(id)
      }
      batches++
      if (result.isDone) break
      cursor = result.continueCursor
    }

    // ============================================
    // Phase 2 : scanner les questionExplanations,
    // compter par questionId et détecter les orphelins
    // ============================================
    const explanationCounts = new Map<Id<"questions">, number>()
    let orphanedExplanationsCount = 0
    const orphanedExplanations: Id<"questionExplanations">[] = []
    let explanationsCount = 0

    cursor = null
    batches = 0
    while (true) {
      if (batches >= MAX_BATCHES) {
        truncated = true
        break
      }
      const result = (await ctx.runQuery(
        internal.migrations.verifyExplanations._listExplanationKeysPage,
        { paginationOpts: { numItems: batchSize, cursor } },
      )) as {
        page: { _id: Id<"questionExplanations">; questionId: Id<"questions"> }[]
        continueCursor: string
        isDone: boolean
      }
      for (const row of result.page) {
        explanationsCount++
        explanationCounts.set(
          row.questionId,
          (explanationCounts.get(row.questionId) ?? 0) + 1,
        )
        if (!allQuestionIds.has(row.questionId)) {
          orphanedExplanationsCount++
          if (orphanedExplanations.length < MAX_ISSUES_REPORTED) {
            orphanedExplanations.push(row._id)
          }
        }
      }
      batches++
      if (result.isDone) break
      cursor = result.continueCursor
    }

    // ============================================
    // Phase 3 : identifier missing et duplicates
    // ============================================
    let missingExplanationsCount = 0
    let duplicateExplanationsCount = 0
    const missingExplanations: Id<"questions">[] = []
    const duplicateQuestionIds: Id<"questions">[] = []

    for (const qId of allQuestionIds) {
      const count = explanationCounts.get(qId) ?? 0
      if (count === 0) {
        missingExplanationsCount++
        if (missingExplanations.length < MAX_ISSUES_REPORTED) {
          missingExplanations.push(qId)
        }
      } else if (count > 1) {
        duplicateExplanationsCount++
        if (duplicateQuestionIds.length < MAX_ISSUES_REPORTED) {
          duplicateQuestionIds.push(qId)
        }
      }
    }

    // L'invariant est valide UNIQUEMENT si :
    // - on n'a pas atteint le garde-fou MAX_BATCHES
    // - aucune anomalie détectée
    // - les comptes correspondent strictement
    const isValid =
      !truncated &&
      missingExplanationsCount === 0 &&
      orphanedExplanationsCount === 0 &&
      duplicateExplanationsCount === 0 &&
      allQuestionIds.size === explanationsCount

    return {
      questionsCount: allQuestionIds.size,
      explanationsCount,
      isValid,
      truncated,
      issues: {
        missingExplanationsCount,
        orphanedExplanationsCount,
        duplicateExplanationsCount,
        missingExplanations,
        orphanedExplanations,
        duplicateQuestionIds,
      },
    }
  },
})
