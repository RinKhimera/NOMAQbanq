import { v } from "convex/values"
import { internal } from "../_generated/api"
import { internalMutation } from "../_generated/server"
import { startMigrationRow, updateMigrationProgress } from "./runner"

/**
 * Migration M4 (PR C — cutover) — Nettoyage physique des champs `explanation`
 * et `references` de la table `questions`.
 *
 * Après le split PR A/B, ces champs ne sont plus lus depuis `questions` : les
 * queries joignent désormais depuis `questionExplanations`. Mais tant que les
 * données ne sont pas physiquement retirées des documents, chaque lecture
 * continue à payer leur bandwidth (Convex n'a pas de projection de champs).
 *
 * Cette migration parcourt toute la table `questions` et, pour chaque document
 * qui contient encore `explanation` ou `references`, appelle `ctx.db.replace()`
 * avec un nouvel objet qui n'inclut PAS ces champs. `replace` est nécessaire
 * parce que `patch` ne peut pas supprimer un champ optional.
 *
 * **Préconditions strictes avant exécution** :
 * 1. PR A et PR B sont déployés et actifs en prod depuis ≥ 24h sans incident.
 * 2. `verifyExplanationsInvariant` retourne `isValid: true` en prod.
 * 3. Le schéma a `explanation: v.optional(v.string())` (sinon `replace` rejette).
 * 4. `createQuestion` / `updateQuestion` n'écrivent plus ces champs dans
 *    la table `questions` (PR C).
 *
 * **Sûreté** :
 * - **Idempotent** : on skippe les documents déjà nettoyés (ni `explanation`
 *   ni `references` présents).
 * - **Non-destructif pour questionExplanations** : cette migration ne touche
 *   QUE la table `questions`. La source de vérité (questionExplanations) est
 *   intacte.
 * - **Resumable** : self-scheduled via `ctx.scheduler.runAfter`, état persisté
 *   dans la table `migrations`.
 * - **Réversibilité** : tant que les lignes `questionExplanations` existent,
 *   on peut théoriquement re-populer les champs dans `questions` (mais ce
 *   serait anti-objectif ; préférer un rollback de code).
 *
 * Exécution recommandée — via le dashboard Convex :
 *   1. Sélectionner explicitement le déploiement cible (dev d'abord, prod ensuite)
 *   2. Onglet Functions → migrations/cleanupOldFieldsFromQuestions
 *      → cleanupOldFieldsFromQuestions
 *   3. Lancer sans arguments. Le worker se reschedule jusqu'à `isDone: true`.
 *
 * Status check (dashboard) :
 *   Functions → migrations/runner → getMigrationStatus
 *   Args: { "name": "cleanupOldFieldsFromQuestions" }
 *
 * Reset pour re-run forcée (dashboard) :
 *   Functions → migrations/runner → resetMigration
 *   Args: { "name": "cleanupOldFieldsFromQuestions" }
 *
 * Vérification post-cleanup :
 *   Re-run `verifyExplanationsInvariant` → doit toujours retourner isValid: true.
 *   Les lignes questionExplanations ne sont pas touchées par cette migration.
 */

const MIGRATION_NAME = "cleanupOldFieldsFromQuestions"
const DEFAULT_BATCH_SIZE = 100

export const cleanupOldFieldsFromQuestions = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    cleaned: v.number(),
    skipped: v.number(),
    isDone: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE
    const isFirstBatch = args.cursor === undefined

    if (isFirstBatch) {
      await startMigrationRow(ctx, MIGRATION_NAME)
    }

    const result = await ctx.db
      .query("questions")
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null })

    let cleaned = 0
    let skipped = 0

    for (const question of result.page) {
      const hasExplanation = question.explanation !== undefined
      const hasReferences = question.references !== undefined

      // Idempotence : skip si le document est déjà nettoyé.
      if (!hasExplanation && !hasReferences) {
        skipped++
        continue
      }

      // Reconstruire explicitement le nouvel objet sans explanation ni
      // references. On ne peut pas utiliser le spread `{ ...question }` avec
      // `delete` car `_id` et `_creationTime` ne sont pas acceptés par `replace`.
      // Lister les champs un à un évite aussi les oublis si le schéma évolue :
      // TypeScript signalera les champs manquants.
      const replacement = {
        question: question.question,
        images: question.images,
        options: question.options,
        correctAnswer: question.correctAnswer,
        objectifCMC: question.objectifCMC,
        domain: question.domain,
        hasImagesComputed: question.hasImagesComputed,
      }

      await ctx.db.replace(question._id, replacement)
      cleaned++
    }

    await updateMigrationProgress(ctx, MIGRATION_NAME, {
      processedDelta: cleaned,
      cursor: result.isDone ? undefined : result.continueCursor,
      isDone: result.isDone,
    })

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.cleanupOldFieldsFromQuestions
          .cleanupOldFieldsFromQuestions,
        {
          cursor: result.continueCursor,
          batchSize,
        },
      )
    }

    console.log(
      `[cleanupOldFieldsFromQuestions] batch terminé : ${cleaned} nettoyés, ${skipped} déjà propres, isDone=${result.isDone}`,
    )

    return {
      cleaned,
      skipped,
      isDone: result.isDone,
      nextCursor: result.isDone ? undefined : result.continueCursor,
    }
  },
})
