import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { internalQuery } from "../_generated/server"

/**
 * Migration M2 — Vérification de l'invariant questions ↔ questionExplanations.
 *
 * Scanne les deux tables et confirme que **pour chaque question, il existe
 * exactement une ligne questionExplanations correspondante**, et qu'aucune
 * ligne questionExplanations n'est orpheline (FK vers une question inexistante).
 *
 * À exécuter :
 * - Après le backfill (M1) pour confirmer que tout est aligné
 * - Avant la cutover (M4) comme garde-fou final
 * - Périodiquement en cas de doute pendant M3
 *
 * **Important** : si `isValid: false`, NE PAS PROCÉDER au cutover. Investiguer
 * les anomalies retournées, corriger, puis re-vérifier.
 *
 * Dashboard : Functions → migrations/verifyExplanations → verifyExplanationsInvariant
 *   Args (optionnels) : { "limit": 10000 }
 *
 * **Limite par défaut** : 10000 documents par table. Si la base dépasse cette
 * taille, augmenter `limit` (attention aux limites de bandwidth Convex par
 * query). Le flag `truncated: true` indique qu'on a atteint la limite et que
 * le résultat est possiblement incomplet.
 *
 * Structure du résultat :
 * - `questionsCount` / `explanationsCount` : nombre de docs lus dans chaque table
 * - `isValid` : true uniquement si AUCUNE anomalie ET non tronqué
 * - `truncated` : true si la limit a été atteinte
 * - `issues` : compteurs et échantillons (max 100 IDs par catégorie)
 *   - `missingExplanationsCount` : nb de questions sans ligne questionExplanations
 *   - `orphanedExplanationsCount` : nb de lignes questionExplanations sans question
 *   - `duplicateExplanationsCount` : nb de questions avec >1 ligne questionExplanations
 */

const DEFAULT_LIMIT = 10000
const MAX_ISSUES_REPORTED = 100

export const verifyExplanationsInvariant = internalQuery({
  args: {
    limit: v.optional(v.number()),
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
    const limit = args.limit ?? DEFAULT_LIMIT

    // Lectures bornées des deux tables.
    // .take(limit) garantit qu'on ne dépassera jamais cette borne, même si
    // la table grossit. Le flag `truncated` ci-dessous nous le signale.
    const questions = await ctx.db.query("questions").take(limit)
    const explanations = await ctx.db
      .query("questionExplanations")
      .take(limit)

    // Index O(1) sur les questions pour la détection d'orphelins.
    const questionsById = new Map(questions.map((q) => [q._id, q]))

    // Compter les explanations par questionId pour détecter les doublons
    // et les manques (count === 0).
    const explanationCounts = new Map<Id<"questions">, number>()
    for (const exp of explanations) {
      explanationCounts.set(
        exp.questionId,
        (explanationCounts.get(exp.questionId) ?? 0) + 1,
      )
    }

    // Identifier les questions sans explanation (missing) et celles avec
    // plusieurs explanations (duplicates).
    let missingExplanationsCount = 0
    let duplicateExplanationsCount = 0
    const missingExplanations: Id<"questions">[] = []
    const duplicateQuestionIds: Id<"questions">[] = []

    for (const q of questions) {
      const count = explanationCounts.get(q._id) ?? 0
      if (count === 0) {
        missingExplanationsCount++
        if (missingExplanations.length < MAX_ISSUES_REPORTED) {
          missingExplanations.push(q._id)
        }
      } else if (count > 1) {
        duplicateExplanationsCount++
        if (duplicateQuestionIds.length < MAX_ISSUES_REPORTED) {
          duplicateQuestionIds.push(q._id)
        }
      }
    }

    // Identifier les explanations orphelines (questionId pointant vers une
    // question qui n'existe pas dans le scan courant).
    let orphanedExplanationsCount = 0
    const orphanedExplanations: Id<"questionExplanations">[] = []
    for (const exp of explanations) {
      if (!questionsById.has(exp.questionId)) {
        orphanedExplanationsCount++
        if (orphanedExplanations.length < MAX_ISSUES_REPORTED) {
          orphanedExplanations.push(exp._id)
        }
      }
    }

    const truncated =
      questions.length === limit || explanations.length === limit

    // L'invariant est valide UNIQUEMENT si :
    // - on n'est pas tronqué (sinon on ne sait pas ce qu'on a manqué)
    // - aucune anomalie détectée
    // - les comptes correspondent strictement
    const isValid =
      !truncated &&
      missingExplanationsCount === 0 &&
      orphanedExplanationsCount === 0 &&
      duplicateExplanationsCount === 0 &&
      questions.length === explanations.length

    return {
      questionsCount: questions.length,
      explanationsCount: explanations.length,
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
