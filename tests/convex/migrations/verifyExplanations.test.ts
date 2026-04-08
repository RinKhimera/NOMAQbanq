import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api, internal } from "../../../convex/_generated/api"
import schema from "../../../convex/schema"
import { createAdminUser } from "../../helpers/convex-helpers"

// Import des modules Convex pour convexTest (Vite spécifique)
const modules = import.meta.glob("../../../convex/**/*.ts")

describe("migrations/verifyExplanations", () => {
  describe("verifyExplanationsInvariant", () => {
    it("retourne isValid=true sur une base vide", async () => {
      const t = convexTest(schema, modules)

      const result = await t.query(
        internal.migrations.verifyExplanations.verifyExplanationsInvariant,
        {},
      )

      expect(result.questionsCount).toBe(0)
      expect(result.explanationsCount).toBe(0)
      expect(result.isValid).toBe(true)
      expect(result.truncated).toBe(false)
      expect(result.issues.missingExplanationsCount).toBe(0)
      expect(result.issues.orphanedExplanationsCount).toBe(0)
      expect(result.issues.duplicateExplanationsCount).toBe(0)
    })

    it("retourne isValid=true quand le dual-write a correctement créé les paires", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Créer 3 questions via l'API normale (dual-write actif)
      for (let i = 0; i < 3; i++) {
        await asAdmin.mutation(api.questions.createQuestion, {
          question: `Question ${i + 1}`,
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: `Explication ${i + 1}`,
          objectifCMC: "Objectif",
          domain: "Cardiologie",
        })
      }

      const result = await t.query(
        internal.migrations.verifyExplanations.verifyExplanationsInvariant,
        {},
      )

      expect(result.questionsCount).toBe(3)
      expect(result.explanationsCount).toBe(3)
      expect(result.isValid).toBe(true)
      expect(result.truncated).toBe(false)
    })

    it("détecte une question sans questionExplanations (missing)", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Question",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Explication",
        objectifCMC: "Objectif",
        domain: "Domain",
      })

      // Supprimer manuellement la ligne questionExplanations pour simuler
      // une question pas backfillée.
      await t.run(async (ctx) => {
        const row = await ctx.db
          .query("questionExplanations")
          .withIndex("by_question", (q) => q.eq("questionId", questionId))
          .unique()
        if (row) await ctx.db.delete(row._id)
      })

      const result = await t.query(
        internal.migrations.verifyExplanations.verifyExplanationsInvariant,
        {},
      )

      expect(result.isValid).toBe(false)
      expect(result.questionsCount).toBe(1)
      expect(result.explanationsCount).toBe(0)
      expect(result.issues.missingExplanationsCount).toBe(1)
      expect(result.issues.missingExplanations).toContain(questionId)
    })

    it("détecte une explanation orpheline (questionId vers une question supprimée)", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Question",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Explication",
        objectifCMC: "Objectif",
        domain: "Domain",
      })

      // Supprimer la question MAIS PAS sa questionExplanations (cas anormal
      // qui peut arriver si quelqu'un contourne deleteQuestion).
      const orphanExplanationId = await t.run(async (ctx) => {
        await ctx.db.delete(questionId)
        const row = await ctx.db
          .query("questionExplanations")
          .withIndex("by_question", (q) => q.eq("questionId", questionId))
          .unique()
        return row?._id
      })

      const result = await t.query(
        internal.migrations.verifyExplanations.verifyExplanationsInvariant,
        {},
      )

      expect(result.isValid).toBe(false)
      expect(result.questionsCount).toBe(0)
      expect(result.explanationsCount).toBe(1)
      expect(result.issues.orphanedExplanationsCount).toBe(1)
      expect(result.issues.orphanedExplanations).toContain(orphanExplanationId)
    })

    it("détecte une question avec plusieurs lignes questionExplanations (duplicate)", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Question",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Explication",
        objectifCMC: "Objectif",
        domain: "Domain",
      })

      // Insérer manuellement une seconde ligne questionExplanations pour
      // la même question (devrait jamais arriver via l'API normale).
      await t.run(async (ctx) => {
        await ctx.db.insert("questionExplanations", {
          questionId,
          explanation: "Doublon accidentel",
        })
      })

      const result = await t.query(
        internal.migrations.verifyExplanations.verifyExplanationsInvariant,
        {},
      )

      expect(result.isValid).toBe(false)
      expect(result.questionsCount).toBe(1)
      expect(result.explanationsCount).toBe(2)
      expect(result.issues.duplicateExplanationsCount).toBe(1)
      expect(result.issues.duplicateQuestionIds).toContain(questionId)
    })

    it("retourne truncated=true et isValid=false si la limit est atteinte", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Créer 3 questions, mais on va lire avec limit=2
      for (let i = 0; i < 3; i++) {
        await asAdmin.mutation(api.questions.createQuestion, {
          question: `Question ${i + 1}`,
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: `Explication ${i + 1}`,
          objectifCMC: "Objectif",
          domain: "Cardiologie",
        })
      }

      const result = await t.query(
        internal.migrations.verifyExplanations.verifyExplanationsInvariant,
        { limit: 2 },
      )

      expect(result.truncated).toBe(true)
      // Quand truncated, isValid doit être false par sécurité (on ne sait
      // pas si les docs non lus introduisent des anomalies)
      expect(result.isValid).toBe(false)
    })
  })
})
