import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api } from "../../convex/_generated/api"
import schema from "../../convex/schema"

// Import des modules Convex pour convexTest (Vite spécifique)
const modules = import.meta.glob("../../convex/**/*.ts")

// Helper pour créer un utilisateur admin pour les tests
const createAdminUser = async (t: ReturnType<typeof convexTest>) => {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Admin",
      email: "admin@example.com",
      image: "https://example.com/avatar.png",
      role: "admin",
      externalId: "clerk_admin",
      tokenIdentifier: "https://clerk.dev|clerk_admin",
    })
  })
  return {
    userId,
    asAdmin: t.withIdentity({
      tokenIdentifier: "https://clerk.dev|clerk_admin",
    }),
  }
}

// Helper pour créer un utilisateur standard
const createRegularUser = async (
  t: ReturnType<typeof convexTest>,
  suffix: string = "",
) => {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: `User ${suffix}`,
      email: `user${suffix}@example.com`,
      image: "https://example.com/avatar.png",
      role: "user",
      externalId: `clerk_user${suffix}`,
      tokenIdentifier: `https://clerk.dev|clerk_user${suffix}`,
    })
  })
  return {
    userId,
    asUser: t.withIdentity({
      tokenIdentifier: `https://clerk.dev|clerk_user${suffix}`,
    }),
  }
}

describe("questions", () => {
  describe("createQuestion", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.mutation(api.questions.createQuestion, {
          question: "Quelle est la capitale de la France ?",
          options: ["Paris", "Lyon", "Marseille", "Bordeaux"],
          correctAnswer: "Paris",
          explanation: "Paris est la capitale de la France",
          objectifCMC: "Géographie",
          domain: "Culture générale",
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("crée une question avec succès en tant qu'admin", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Quelle est la capitale de la France ?",
        options: ["Paris", "Lyon", "Marseille", "Bordeaux"],
        correctAnswer: "Paris",
        explanation: "Paris est la capitale de la France",
        objectifCMC: "Géographie",
        domain: "Culture générale",
      })

      expect(questionId).toBeDefined()

      // Vérifier que la question existe
      const questions = await t.query(api.questions.getAllQuestions)
      expect(questions).toHaveLength(1)
      expect(questions[0].question).toBe(
        "Quelle est la capitale de la France ?",
      )
    })

    it("crée une question avec références", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Identifier cette pathologie",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: "Option A",
        explanation: "Explication détaillée",
        references: ["Ref 1", "Ref 2"],
        objectifCMC: "Diagnostic",
        domain: "Cardiologie",
      })

      expect(questionId).toBeDefined()

      const questions = await t.query(api.questions.getAllQuestions)
      expect(questions[0].references).toEqual(["Ref 1", "Ref 2"])
    })
  })

  describe("getAllQuestions", () => {
    it("retourne une liste vide initialement", async () => {
      const t = convexTest(schema, modules)

      const questions = await t.query(api.questions.getAllQuestions)
      expect(questions).toEqual([])
    })

    it("retourne toutes les questions triées par date décroissante", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Créer plusieurs questions
      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Question 1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Explication 1",
        objectifCMC: "Objectif 1",
        domain: "Domain 1",
      })

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Question 2",
        options: ["A", "B", "C", "D"],
        correctAnswer: "B",
        explanation: "Explication 2",
        objectifCMC: "Objectif 2",
        domain: "Domain 2",
      })

      const questions = await t.query(api.questions.getAllQuestions)
      expect(questions).toHaveLength(2)
      // La plus récente en premier (order: "desc")
      expect(questions[0].question).toBe("Question 2")
    })
  })

  describe("updateQuestion", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)
      const { asUser } = await createRegularUser(t)

      // Créer une question en tant qu'admin
      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Question originale",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Explication",
        objectifCMC: "Objectif",
        domain: "Domain",
      })

      // Essayer de modifier en tant qu'utilisateur
      await expect(
        asUser.mutation(api.questions.updateQuestion, {
          id: questionId,
          question: "Question modifiée",
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("met à jour une question avec succès", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Question originale",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Explication",
        objectifCMC: "Objectif",
        domain: "Domain",
      })

      await asAdmin.mutation(api.questions.updateQuestion, {
        id: questionId,
        question: "Question modifiée",
        correctAnswer: "B",
      })

      const questions = await t.query(api.questions.getAllQuestions)
      expect(questions[0].question).toBe("Question modifiée")
      expect(questions[0].correctAnswer).toBe("B")
      // Les autres champs restent inchangés
      expect(questions[0].explanation).toBe("Explication")
    })
  })

  describe("deleteQuestion", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)
      const { asUser } = await createRegularUser(t)

      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Question à supprimer",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Explication",
        objectifCMC: "Objectif",
        domain: "Domain",
      })

      await expect(
        asUser.mutation(api.questions.deleteQuestion, { id: questionId }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("supprime une question avec succès", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Question à supprimer",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Explication",
        objectifCMC: "Objectif",
        domain: "Domain",
      })

      // Vérifier que la question existe
      let questions = await t.query(api.questions.getAllQuestions)
      expect(questions).toHaveLength(1)

      // Supprimer la question
      await asAdmin.mutation(api.questions.deleteQuestion, { id: questionId })

      // Vérifier que la question a été supprimée
      questions = await t.query(api.questions.getAllQuestions)
      expect(questions).toHaveLength(0)
    })
  })

  describe("getQuestionStats", () => {
    it("retourne des statistiques vides si aucune question", async () => {
      const t = convexTest(schema, modules)

      const stats = await t.query(api.questions.getQuestionStats)
      expect(stats.totalCount).toBe(0)
      expect(stats.domainStats).toEqual([])
    })

    it("compte correctement les questions par domaine", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Créer des questions dans différents domaines
      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "Cardiologie",
      })

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q2",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E2",
        objectifCMC: "O2",
        domain: "Cardiologie",
      })

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q3",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E3",
        objectifCMC: "O3",
        domain: "Neurologie",
      })

      const stats = await t.query(api.questions.getQuestionStats)
      expect(stats.totalCount).toBe(3)
      expect(stats.domainStats).toHaveLength(2)

      const cardioStat = stats.domainStats.find(
        (s) => s.domain === "Cardiologie",
      )
      const neuroStat = stats.domainStats.find((s) => s.domain === "Neurologie")

      expect(cardioStat?.count).toBe(2)
      expect(neuroStat?.count).toBe(1)
    })

    it("met à jour les stats après suppression d'une question", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Créer 2 questions dans le même domaine
      const questionId1 = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "Cardiologie",
      })

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q2",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E2",
        objectifCMC: "O2",
        domain: "Cardiologie",
      })

      // Vérifier les stats avant suppression
      let stats = await t.query(api.questions.getQuestionStats)
      expect(stats.totalCount).toBe(2)

      // Supprimer une question
      await asAdmin.mutation(api.questions.deleteQuestion, { id: questionId1 })

      // Vérifier les stats après suppression
      stats = await t.query(api.questions.getQuestionStats)
      expect(stats.totalCount).toBe(1)
      expect(
        stats.domainStats.find((s) => s.domain === "Cardiologie")?.count,
      ).toBe(1)
    })

    it("supprime le domaine des stats quand le dernier élément est supprimé", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Créer une seule question dans un domaine
      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "Pédiatrie",
      })

      // Vérifier que le domaine existe
      let stats = await t.query(api.questions.getQuestionStats)
      expect(
        stats.domainStats.find((s) => s.domain === "Pédiatrie"),
      ).toBeDefined()

      // Supprimer la question
      await asAdmin.mutation(api.questions.deleteQuestion, { id: questionId })

      // Le domaine ne devrait plus être dans les stats
      stats = await t.query(api.questions.getQuestionStats)
      expect(stats.totalCount).toBe(0)
      expect(
        stats.domainStats.find((s) => s.domain === "Pédiatrie"),
      ).toBeUndefined()
    })

    it("met à jour les stats lors d'un changement de domaine", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Créer une question
      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "Cardiologie",
      })

      // Vérifier les stats initiales
      let stats = await t.query(api.questions.getQuestionStats)
      expect(
        stats.domainStats.find((s) => s.domain === "Cardiologie")?.count,
      ).toBe(1)
      expect(
        stats.domainStats.find((s) => s.domain === "Neurologie"),
      ).toBeUndefined()

      // Changer le domaine
      await asAdmin.mutation(api.questions.updateQuestion, {
        id: questionId,
        domain: "Neurologie",
      })

      // Vérifier que les stats sont mises à jour
      stats = await t.query(api.questions.getQuestionStats)
      expect(stats.totalCount).toBe(1) // Total inchangé
      expect(
        stats.domainStats.find((s) => s.domain === "Cardiologie"),
      ).toBeUndefined()
      expect(
        stats.domainStats.find((s) => s.domain === "Neurologie")?.count,
      ).toBe(1)
    })
  })

  describe("getQuestionsWithPagination", () => {
    it("pagine correctement les résultats", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Créer 5 questions
      for (let i = 1; i <= 5; i++) {
        await asAdmin.mutation(api.questions.createQuestion, {
          question: `Question ${i}`,
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: `Explication ${i}`,
          objectifCMC: `Objectif ${i}`,
          domain: "Domain",
        })
      }

      // Première page (2 items par page)
      const page1 = await t.query(api.questions.getQuestionsWithPagination, {
        paginationOpts: { numItems: 2, cursor: null },
      })

      expect(page1.page).toHaveLength(2)
      expect(page1.isDone).toBe(false)
      expect(page1.continueCursor).toBeTruthy()

      // Deuxième page
      const page2 = await t.query(api.questions.getQuestionsWithPagination, {
        paginationOpts: { numItems: 2, cursor: page1.continueCursor },
      })

      expect(page2.page).toHaveLength(2)
      expect(page2.isDone).toBe(false)

      // Troisième page (dernière)
      const page3 = await t.query(api.questions.getQuestionsWithPagination, {
        paginationOpts: { numItems: 2, cursor: page2.continueCursor },
      })

      expect(page3.page).toHaveLength(1) // 5 % 2 = 1
      expect(page3.isDone).toBe(true)
    })

    it("filtre par domaine", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q Cardio",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "O",
        domain: "Cardiologie",
      })

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q Neuro",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "O",
        domain: "Neurologie",
      })

      const result = await t.query(api.questions.getQuestionsWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        domain: "Cardiologie",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].domain).toBe("Cardiologie")
    })

    it("filtre par recherche textuelle", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Symptômes de l'infarctus",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "Cardiologie urgente",
        domain: "Cardiologie",
      })

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Traitement AVC",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "Neurologie urgente",
        domain: "Neurologie",
      })

      const result = await t.query(api.questions.getQuestionsWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        searchQuery: "infarctus",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].question).toContain("infarctus")
    })

    it("filtre par domaine et recherche combinés", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Infarctus du myocarde",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "O",
        domain: "Cardiologie",
      })

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Infarctus cérébral",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "O",
        domain: "Neurologie",
      })

      // Search for "infarctus" in Cardiologie domain
      const result = await t.query(api.questions.getQuestionsWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        domain: "Cardiologie",
        searchQuery: "infarctus",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].domain).toBe("Cardiologie")
    })
  })

  describe("getRandomQuestions", () => {
    it("retourne le nombre demandé de questions aléatoires", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      // Créer 5 questions
      for (let i = 1; i <= 5; i++) {
        await asAdmin.mutation(api.questions.createQuestion, {
          question: `Question ${i}`,
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: `Explication ${i}`,
          objectifCMC: `Objectif ${i}`,
          domain: "Domain",
        })
      }

      const result = await t.query(api.questions.getRandomQuestions, {
        count: 3,
      })

      expect(result).toHaveLength(3)
    })

    it("filtre par domaine avec index", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1 Cardio",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "O",
        domain: "Cardiologie",
      })

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q2 Cardio",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "O",
        domain: "Cardiologie",
      })

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Q Neuro",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "O",
        domain: "Neurologie",
      })

      const result = await t.query(api.questions.getRandomQuestions, {
        count: 10,
        domain: "Cardiologie",
      })

      expect(result).toHaveLength(2)
      expect(result.every((q) => q.domain === "Cardiologie")).toBe(true)
    })

    it("retourne moins si pas assez de questions", async () => {
      const t = convexTest(schema, modules)
      const { asAdmin } = await createAdminUser(t)

      await asAdmin.mutation(api.questions.createQuestion, {
        question: "Seule question",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "O",
        domain: "Domain",
      })

      const result = await t.query(api.questions.getRandomQuestions, {
        count: 10,
      })

      expect(result).toHaveLength(1)
    })
  })

  // Note: Tests Learning Bank supprimés - table learningBankQuestions remplacée par le nouveau système training
  // Les tests pour le nouveau système training seront dans tests/convex/training.test.ts
})
