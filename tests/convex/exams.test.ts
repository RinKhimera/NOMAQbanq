import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api, internal } from "../../convex/_generated/api"
import { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

// Import des modules Convex pour convexTest (Vite spécifique)
const modules = import.meta.glob("../../convex/**/*.ts")

// Cache pour les produits de test (réutilisés au sein d'un même test)
const productCache = new Map<string, Id<"products">>()

// Helper pour accorder l'accès exam ou training à un utilisateur (optimisé)
const grantAccess = async (
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  accessType: "exam" | "training",
) => {
  await t.run(async (ctx) => {
    // Réutiliser le produit existant ou en créer un nouveau
    const cacheKey = accessType
    let productId = productCache.get(cacheKey)

    if (!productId) {
      productId = await ctx.db.insert("products", {
        code: accessType === "exam" ? "exam_access" : "training_access",
        name: accessType === "exam" ? "Accès Examens" : "Accès Entraînement",
        description: "Test product",
        priceCAD: 5000,
        durationDays: 30,
        accessType,
        stripeProductId: `prod_test_${accessType}`,
        stripePriceId: `price_test_${accessType}`,
        isActive: true,
      })
      productCache.set(cacheKey, productId)
    }

    // Créer une transaction (minimal)
    const transactionId = await ctx.db.insert("transactions", {
      userId,
      productId,
      type: "manual",
      status: "completed",
      amountPaid: 0,
      currency: "CAD",
      accessType,
      durationDays: 30,
      accessExpiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
    })

    // Créer l'accès utilisateur
    await ctx.db.insert("userAccess", {
      userId,
      accessType,
      expiresAt: Date.now() + 86400000,
      lastTransactionId: transactionId,
    })
  })
}

// Nettoyer le cache entre les tests
import { beforeEach } from "vitest"
beforeEach(() => {
  productCache.clear()
})

// Helper pour créer un utilisateur admin
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

// Helper pour créer une question
const createQuestion = async (
  t: ReturnType<typeof convexTest>,
  admin: ReturnType<typeof createAdminUser> extends Promise<infer R>
    ? R
    : never,
  index: number = 1,
) => {
  return await admin.asAdmin.mutation(api.questions.createQuestion, {
    question: `Question ${index}`,
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    explanation: `Explication ${index}`,
    objectifCMC: `Objectif ${index}`,
    domain: "Domain",
  })
}

describe("exams", () => {
  describe("createExam", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.mutation(api.exams.createExam, {
          title: "Examen Test",
          startDate: Date.now(),
          endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
          questionIds: [],

        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("crée un examen avec succès", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen EACMC",
        description: "Description de l'examen",
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      expect(examId).toBeDefined()

      const exams = await t.query(api.exams.getAllExams)
      expect(exams).toHaveLength(1)
      expect(exams[0].title).toBe("Examen EACMC")
      expect(exams[0].completionTime).toBe(83) // 1 question * 83 secondes
      expect(exams[0].isActive).toBe(true)
    })

    it("calcule le temps de completion correctement", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)

      // Créer 5 questions
      const questionIds: Id<"questions">[] = []
      for (let i = 0; i < 5; i++) {
        const qId = await createQuestion(t, admin, i)
        questionIds.push(qId)
      }

      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen Multi-questions",
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds,

      })

      const exams = await t.query(api.exams.getAllExams)
      expect(exams[0].completionTime).toBe(5 * 83) // 5 questions * 83 secondes
    })

    it("configure la pause correctement", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
        pauseDurationMinutes: 30,
      })

      const exams = await t.query(api.exams.getAllExams)
      expect(exams[0].enablePause).toBe(true)
      expect(exams[0].pauseDurationMinutes).toBe(30)
    })

    it("limite la durée de pause à 60 minutes", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec longue pause",
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
        pauseDurationMinutes: 120, // Plus que le max
      })

      const exams = await t.query(api.exams.getAllExams)
      expect(exams[0].pauseDurationMinutes).toBe(60) // Limité à 60
    })
  })

  describe("updateExam", () => {
    it("met à jour un examen avec succès", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Titre original",
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      await admin.asAdmin.mutation(api.exams.updateExam, {
        examId,
        title: "Titre modifié",
        description: "Nouvelle description",
        startDate: Date.now(),
        endDate: Date.now() + 14 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      const exams = await t.query(api.exams.getAllExams)
      expect(exams[0].title).toBe("Titre modifié")
      expect(exams[0].description).toBe("Nouvelle description")
    })
  })

  describe("deleteExam", () => {
    it("supprime un examen avec succès", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen à supprimer",
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      let exams = await t.query(api.exams.getAllExams)
      expect(exams).toHaveLength(1)

      await admin.asAdmin.mutation(api.exams.deleteExam, { examId })

      exams = await t.query(api.exams.getAllExams)
      expect(exams).toHaveLength(0)
    })
  })

  describe("deactivateExam & reactivateExam", () => {
    it("désactive et réactive un examen", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Vérifier que l'examen est actif
      let exams = await t.query(api.exams.getAllExams)
      expect(exams[0].isActive).toBe(true)

      // Désactiver
      await admin.asAdmin.mutation(api.exams.deactivateExam, { examId })
      exams = await t.query(api.exams.getAllExams)
      expect(exams[0].isActive).toBe(false)

      // Réactiver
      await admin.asAdmin.mutation(api.exams.reactivateExam, { examId })
      exams = await t.query(api.exams.getAllExams)
      expect(exams[0].isActive).toBe(true)
    })
  })

  describe("getMyAvailableExams", () => {
    it("retourne uniquement les examens actifs et dans la période pour les utilisateurs autorisés", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      const now = Date.now()

      // Examen actif dans la période
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen actif",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Examen pas encore commencé
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen futur",
        startDate: now + 24 * 60 * 60 * 1000,
        endDate: now + 14 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Examen terminé
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen passé",
        startDate: now - 14 * 24 * 60 * 60 * 1000,
        endDate: now - 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const availableExams = await user.asUser.query(api.exams.getMyAvailableExams)
      expect(availableExams).toHaveLength(1)
      expect(availableExams[0].title).toBe("Examen actif")
    })

    it("filtre par participants autorisés pour les utilisateurs non-admin", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)

      const now = Date.now()

      // Examen actif
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen pour user1",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Accorder l'accès exam à user1 seulement
      await grantAccess(t, user1.userId, "exam")

      // User1 devrait voir l'examen (a un accès exam actif)
      const user1Exams = await user1.asUser.query(api.exams.getMyAvailableExams)
      expect(user1Exams).toHaveLength(1)

      // User2 ne devrait pas voir l'examen (pas d'accès exam)
      const user2Exams = await user2.asUser.query(api.exams.getMyAvailableExams)
      expect(user2Exams).toHaveLength(0)
    })
  })

  describe("startExam", () => {
    it("démarre une session d'examen", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      const result = await user.asUser.mutation(api.exams.startExam, { examId })
      expect(result.startedAt).toBeDefined()

      // Vérifier la session
      const session = await user.asUser.query(api.exams.getExamSession, {
        examId,
      })
      expect(session?.status).toBe("in_progress")
    })

    it("rejette si l'utilisateur n'a pas d'accès exam actif", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2") // Pas d'accès exam
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam uniquement à user1
      await grantAccess(t, user1.userId, "exam")
      // user2 n'a pas d'accès exam

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
      })

      // user2 sans accès exam ne peut pas démarrer l'examen
      await expect(
        user2.asUser.mutation(api.exams.startExam, { examId }),
      ).rejects.toThrow("Accès aux examens requis")
    })

    it("rejette si l'examen n'est pas disponible", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      // Examen dans le futur
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen futur",
        startDate: now + 24 * 60 * 60 * 1000,
        endDate: now + 14 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      await expect(
        user.asUser.mutation(api.exams.startExam, { examId }),
      ).rejects.toThrow("L'examen n'est pas disponible à cette période")
    })

    it("initialise la phase de pause si enablePause est activé", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
        pauseDurationMinutes: 15,
      })

      const result = await user.asUser.mutation(api.exams.startExam, { examId })
      expect(result.pausePhase).toBe("before_pause")
    })
  })

  describe("submitExamAnswers", () => {
    it("soumet les réponses et calcule le score", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      // Créer des questions avec réponses connues
      const q1 = await admin.asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "D1",
      })

      const q2 = await admin.asAdmin.mutation(api.questions.createQuestion, {
        question: "Q2",
        options: ["A", "B", "C", "D"],
        correctAnswer: "B",
        explanation: "E2",
        objectifCMC: "O2",
        domain: "D2",
      })

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1, q2],

      })

      // Démarrer l'examen
      await user.asUser.mutation(api.exams.startExam, { examId })

      // Soumettre les réponses (1 correct, 1 incorrect)
      const result = await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [
          { questionId: q1, selectedAnswer: "A" }, // Correct
          { questionId: q2, selectedAnswer: "C" }, // Incorrect
        ],
        correctAnswers: {
          [q1]: "A",
          [q2]: "B",
        },
      })

      expect(result.score).toBe(50) // 1/2 = 50%
      expect(result.correctAnswers).toBe(1)
      expect(result.totalQuestions).toBe(2)
    })

    it("rejette si l'examen n'a pas été démarré", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Sans démarrer l'examen
      await expect(
        user.asUser.mutation(api.exams.submitExamAnswers, {
          examId,
          answers: [{ questionId, selectedAnswer: "A" }],
        }),
      ).rejects.toThrow("Session d'examen non trouvée")
    })

    it("rejette si l'examen a déjà été complété", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Démarrer et soumettre une première fois
      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [{ questionId, selectedAnswer: "A" }],
      })

      // Essayer de soumettre à nouveau
      await expect(
        user.asUser.mutation(api.exams.submitExamAnswers, {
          examId,
          answers: [{ questionId, selectedAnswer: "B" }],
        }),
      ).rejects.toThrow("Vous avez déjà passé cet examen")
    })
  })

  describe("getExamLeaderboard", () => {
    it("retourne le classement trié par score", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")

      // Accorder l'accès exam aux utilisateurs
      await grantAccess(t, user1.userId, "exam")
      await grantAccess(t, user2.userId, "exam")

      const q1 = await admin.asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "D1",
      })

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1],

      })

      // User1 répond correctement (100%)
      await user1.asUser.mutation(api.exams.startExam, { examId })
      await user1.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [{ questionId: q1, selectedAnswer: "A" }],
        correctAnswers: { [q1]: "A" },
      })

      // User2 répond incorrectement (0%)
      await user2.asUser.mutation(api.exams.startExam, { examId })
      await user2.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [{ questionId: q1, selectedAnswer: "B" }],
        correctAnswers: { [q1]: "A" },
      })

      // Admin peut toujours voir le leaderboard
      const leaderboard = await admin.asAdmin.query(
        api.exams.getExamLeaderboard,
        { examId },
      )
      expect(leaderboard).toHaveLength(2)
      expect(leaderboard[0].score).toBe(100)
      expect(leaderboard[1].score).toBe(0)
    })
  })

  describe("getAllExams", () => {
    it("retourne les examens avec le nombre de participants", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen Test",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Vérifier le compteur avant participation
      let exams = await t.query(api.exams.getAllExams)
      expect(exams).toHaveLength(1)
      expect(exams[0].participantCount).toBe(0)

      // L'utilisateur démarre l'examen
      await user.asUser.mutation(api.exams.startExam, { examId })

      // Vérifier le compteur après participation
      exams = await t.query(api.exams.getAllExams)
      expect(exams[0].participantCount).toBe(1)
    })
  })

  describe("getExamWithQuestions", () => {
    it("retourne l'examen avec ses questions", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const q1 = await createQuestion(t, admin, 1)
      const q2 = await createQuestion(t, admin, 2)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec questions",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1, q2],

      })

      const result = await t.query(api.exams.getExamWithQuestions, { examId })
      expect(result).not.toBeNull()
      expect(result!.title).toBe("Examen avec questions")
      expect(result!.questions).toHaveLength(2)
      expect(result!.questions[0]!.question).toBe("Question 1")
      expect(result!.questions[1]!.question).toBe("Question 2")
    })
  })

  describe("startPause", () => {
    it("démarre la pause correctement avec manualTrigger", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
        pauseDurationMinutes: 15,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })

      const result = await user.asUser.mutation(api.exams.startPause, {
        examId,
        manualTrigger: true,
      })

      expect(result.pauseStartedAt).toBeDefined()
      expect(result.pauseDurationMinutes).toBe(15)
    })

    it("rejette si pause non activée pour l'examen", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen sans pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: false,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })

      await expect(
        user.asUser.mutation(api.exams.startPause, { examId }),
      ).rejects.toThrow("La pause n'est pas activée pour cet examen")
    })

    it("rejette si déjà en pause", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
        pauseDurationMinutes: 15,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.startPause, {
        examId,
        manualTrigger: true,
      })

      await expect(
        user.asUser.mutation(api.exams.startPause, {
          examId,
          manualTrigger: true,
        }),
      ).rejects.toThrow("La pause ne peut être démarrée qu'une seule fois")
    })
  })

  describe("resumeFromPause", () => {
    it("reprend correctement après la pause", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
        pauseDurationMinutes: 15,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.startPause, {
        examId,
        manualTrigger: true,
      })

      const result = await user.asUser.mutation(api.exams.resumeFromPause, {
        examId,
      })

      expect(result.pauseEndedAt).toBeDefined()
      expect(result.isPauseCutShort).toBe(true) // Reprise avant la fin des 15 minutes
      expect(result.totalPauseDurationMs).toBeDefined()
    })

    it("rejette si pas en pause", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
        pauseDurationMinutes: 15,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })

      await expect(
        user.asUser.mutation(api.exams.resumeFromPause, { examId }),
      ).rejects.toThrow("Vous n'êtes pas actuellement en pause")
    })
  })

  describe("getPauseStatus", () => {
    it("retourne le statut de pause avec calculs midpoint", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      // Créer 4 questions pour tester le midpoint
      const q1 = await createQuestion(t, admin, 1)
      const q2 = await createQuestion(t, admin, 2)
      const q3 = await createQuestion(t, admin, 3)
      const q4 = await createQuestion(t, admin, 4)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1, q2, q3, q4],

        enablePause: true,
        pauseDurationMinutes: 20,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })

      const status = await user.asUser.query(api.exams.getPauseStatus, {
        examId,
      })

      expect(status).not.toBeNull()
      expect(status?.enablePause).toBe(true)
      expect(status?.pauseDurationMinutes).toBe(20)
      expect(status?.totalQuestions).toBe(4)
      expect(status?.midpoint).toBe(2)
      expect(status?.questionsBeforePause).toBe(2)
      expect(status?.questionsAfterPause).toBe(2)
      expect(status?.pausePhase).toBe("before_pause")
    })

    it("retourne null si non authentifié", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
      })

      const status = await t.query(api.exams.getPauseStatus, { examId })
      expect(status).toBeNull()
    })
  })

  describe("validateQuestionAccess", () => {
    it("before_pause bloque questions après midpoint", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const q1 = await createQuestion(t, admin, 1)
      const q2 = await createQuestion(t, admin, 2)
      const q3 = await createQuestion(t, admin, 3)
      const q4 = await createQuestion(t, admin, 4)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1, q2, q3, q4],

        enablePause: true,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })

      // Question 0 et 1 (avant midpoint) devraient être accessibles
      const access0 = await user.asUser.query(api.exams.validateQuestionAccess, {
        examId,
        questionIndex: 0,
      })
      expect(access0.allowed).toBe(true)

      const access1 = await user.asUser.query(api.exams.validateQuestionAccess, {
        examId,
        questionIndex: 1,
      })
      expect(access1.allowed).toBe(true)

      // Question 2 et 3 (après midpoint) devraient être bloquées
      const access2 = await user.asUser.query(api.exams.validateQuestionAccess, {
        examId,
        questionIndex: 2,
      })
      expect(access2.allowed).toBe(false)
      expect(access2.reason).toContain("déverrouillée après la pause")
    })

    it("during_pause bloque toutes les questions", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.startPause, {
        examId,
        manualTrigger: true,
      })

      const access = await user.asUser.query(api.exams.validateQuestionAccess, {
        examId,
        questionIndex: 0,
      })
      expect(access.allowed).toBe(false)
      expect(access.reason).toContain("verrouillées pendant la pause")
    })

    it("after_pause autorise toutes les questions", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const q1 = await createQuestion(t, admin, 1)
      const q2 = await createQuestion(t, admin, 2)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1, q2],

        enablePause: true,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.startPause, {
        examId,
        manualTrigger: true,
      })
      await user.asUser.mutation(api.exams.resumeFromPause, { examId })

      const access0 = await user.asUser.query(api.exams.validateQuestionAccess, {
        examId,
        questionIndex: 0,
      })
      expect(access0.allowed).toBe(true)

      const access1 = await user.asUser.query(api.exams.validateQuestionAccess, {
        examId,
        questionIndex: 1,
      })
      expect(access1.allowed).toBe(true)
    })

    it("autorise si pause non activée", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen sans pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: false,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })

      const access = await user.asUser.query(api.exams.validateQuestionAccess, {
        examId,
        questionIndex: 0,
      })
      expect(access.allowed).toBe(true)
    })
  })

  describe("getMyDashboardStats", () => {
    it("retourne les statistiques de l'utilisateur", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const q1 = await admin.asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "D1",
      })

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1],

      })

      // Avant participation
      let stats = await user.asUser.query(api.exams.getMyDashboardStats)
      expect(stats).not.toBeNull()
      expect(stats?.availableExamsCount).toBe(1)
      expect(stats?.completedExamsCount).toBe(0)

      // Après participation
      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [{ questionId: q1, selectedAnswer: "A" }],
        correctAnswers: { [q1]: "A" },
      })

      stats = await user.asUser.query(api.exams.getMyDashboardStats)
      expect(stats?.completedExamsCount).toBe(1)
      expect(stats?.averageScore).toBe(100)
    })

    it("retourne null si non authentifié", async () => {
      const t = convexTest(schema, modules)
      const stats = await t.query(api.exams.getMyDashboardStats)
      expect(stats).toBeNull()
    })
  })

  describe("getMyRecentExams", () => {
    it("retourne les examens récents triés", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const q1 = await createQuestion(t, admin, 1)

      const now = Date.now()

      // Créer 2 examens
      const exam1 = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen 1",
        startDate: now - 2000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1],

      })

      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen 2",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1],

      })

      // Compléter le premier examen
      await user.asUser.mutation(api.exams.startExam, { examId: exam1 })
      await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId: exam1,
        answers: [{ questionId: q1, selectedAnswer: "A" }],
      })

      const recentExams = await user.asUser.query(api.exams.getMyRecentExams)
      expect(recentExams).toHaveLength(2)
      // Le premier (complété) devrait être en tête
      expect(recentExams[0].title).toBe("Examen 1")
      expect(recentExams[0].isCompleted).toBe(true)
      expect(recentExams[1].title).toBe("Examen 2")
      expect(recentExams[1].isCompleted).toBe(false)
    })

    it("retourne une liste vide si non authentifié", async () => {
      const t = convexTest(schema, modules)
      const exams = await t.query(api.exams.getMyRecentExams)
      expect(exams).toEqual([])
    })
  })

  describe("getAllExamsWithUserParticipation", () => {
    it("retourne les examens avec statut de participation", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const q1 = await createQuestion(t, admin, 1)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen Test",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1],

      })

      // Avant participation
      let exams = await user.asUser.query(api.exams.getAllExamsWithUserParticipation)
      expect(exams).toHaveLength(1)
      expect(exams[0].userHasTaken).toBe(false)
      expect(exams[0].userParticipation).toBeNull()

      // Après participation
      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [{ questionId: q1, selectedAnswer: "A" }],
        correctAnswers: { [q1]: "A" },
      })

      exams = await user.asUser.query(api.exams.getAllExamsWithUserParticipation)
      expect(exams[0].userHasTaken).toBe(true)
      expect(exams[0].userParticipation?.status).toBe("completed")
      expect(exams[0].userParticipation?.score).toBe(100)
    })

    it("retourne userHasTaken false si non authentifié", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      const exams = await t.query(api.exams.getAllExamsWithUserParticipation)
      expect(exams).toHaveLength(1)
      expect(exams[0].userHasTaken).toBe(false)
    })
  })

  describe("getParticipantExamResults", () => {
    it("admin peut voir les résultats d'un participant non complété", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Démarrer mais ne pas soumettre
      await user.asUser.mutation(api.exams.startExam, { examId })

      const result = await admin.asAdmin.query(api.exams.getParticipantExamResults, {
        examId,
        userId: user.userId,
      })

      expect(result).not.toBeNull()
      expect(result?.error).toBe("NOT_COMPLETED")
    })

    it("admin peut voir message si participant n'a pas commencé", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      const result = await admin.asAdmin.query(api.exams.getParticipantExamResults, {
        examId,
        userId: user.userId,
      })

      expect(result).not.toBeNull()
      expect(result?.error).toBe("NO_PARTICIPATION")
    })

    it("utilisateur ne peut pas voir résultats pendant l'examen", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000, // Pas encore terminé
        questionIds: [questionId],

      })

      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [{ questionId, selectedAnswer: "A" }],
      })

      // L'utilisateur essaie de voir ses résultats pendant l'examen
      const result = await user.asUser.query(api.exams.getParticipantExamResults, {
        examId,
        userId: user.userId,
      })

      // Pendant l'examen, les non-admins ne peuvent pas voir les résultats
      expect(result).toBeNull()
    })

    it("retourne null si non authentifié", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      const result = await t.query(api.exams.getParticipantExamResults, {
        examId,
        userId: user.userId,
      })

      expect(result).toBeNull()
    })

    it("retourne null si utilisateur essaie de voir résultats d'un autre", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now - 100, // Terminé
        questionIds: [questionId],

      })

      // User1 essaie de voir les résultats de user2
      const result = await user1.asUser.query(api.exams.getParticipantExamResults, {
        examId,
        userId: user2.userId,
      })

      expect(result).toBeNull()
    })
  })

  describe("getExamLeaderboard - authorization", () => {
    it("utilisateur non autorisé mais ayant participé peut voir le leaderboard après la fin", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 2000,
        endDate: now - 1000, // Terminé
        questionIds: [questionId],

      })

      // Simuler une participation en insérant directement
      await t.run(async (ctx) => {
        await ctx.db.insert("examParticipations", {
          examId,
          userId: user.userId,
          startedAt: now - 1500,
          completedAt: now - 1200,
          status: "completed",
          score: 100,
        })
      })

      const leaderboard = await user.asUser.query(api.exams.getExamLeaderboard, {
        examId,
      })

      expect(leaderboard).toHaveLength(1)
    })

    it("utilisateur non authentifié ne peut pas voir le leaderboard", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 2000,
        endDate: now - 1000,
        questionIds: [questionId],

      })

      const leaderboard = await t.query(api.exams.getExamLeaderboard, { examId })
      expect(leaderboard).toEqual([])
    })
  })

  describe("submitExamAnswers - pause validation", () => {
    it("rejette soumission pendant during_pause", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

        enablePause: true,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.startPause, {
        examId,
        manualTrigger: true,
      })

      // Essayer de soumettre pendant la pause
      await expect(
        user.asUser.mutation(api.exams.submitExamAnswers, {
          examId,
          answers: [{ questionId, selectedAnswer: "A" }],
        }),
      ).rejects.toThrow("Soumission non autorisée pendant la pause")
    })

    it("détecte fraude - réponse à question verrouillée pendant before_pause", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Créer 4 questions pour avoir un midpoint à 2
      const q1 = await createQuestion(t, admin, 1)
      const q2 = await createQuestion(t, admin, 2)
      const q3 = await createQuestion(t, admin, 3)
      const q4 = await createQuestion(t, admin, 4)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause - test fraude",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1, q2, q3, q4], // Midpoint = 2

        enablePause: true,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })
      // On est maintenant en before_pause

      // Tentative de répondre à une question après le midpoint (Q3 = index 2)
      await expect(
        user.asUser.mutation(api.exams.submitExamAnswers, {
          examId,
          answers: [{ questionId: q3, selectedAnswer: "A" }],
        }),
      ).rejects.toThrow("Tentative frauduleuse détectée")
    })

    it("autorise réponse à questions avant midpoint pendant before_pause", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Créer 4 questions pour avoir un midpoint à 2
      const q1 = await createQuestion(t, admin, 1)
      const q2 = await createQuestion(t, admin, 2)
      const q3 = await createQuestion(t, admin, 3)
      const q4 = await createQuestion(t, admin, 4)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause - test autorisé",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1, q2, q3, q4], // Midpoint = 2

        enablePause: true,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })
      // On est maintenant en before_pause

      // Répondre aux questions avant le midpoint (Q1, Q2 = index 0, 1) devrait fonctionner
      const result = await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [
          { questionId: q1, selectedAnswer: "A" },
          { questionId: q2, selectedAnswer: "B" },
        ],
      })

      expect(result.score).toBeDefined()
    })

    it("autorise toutes les questions après after_pause", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      // Créer 4 questions
      const q1 = await createQuestion(t, admin, 1)
      const q2 = await createQuestion(t, admin, 2)
      const q3 = await createQuestion(t, admin, 3)
      const q4 = await createQuestion(t, admin, 4)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause - test après pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1, q2, q3, q4],

        enablePause: true,
      })

      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.startPause, {
        examId,
        manualTrigger: true,
      })
      await user.asUser.mutation(api.exams.resumeFromPause, { examId })
      // On est maintenant en after_pause

      // Toutes les questions devraient être autorisées
      const result = await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [
          { questionId: q1, selectedAnswer: "A" },
          { questionId: q2, selectedAnswer: "B" },
          { questionId: q3, selectedAnswer: "C" },
          { questionId: q4, selectedAnswer: "D" },
        ],
      })

      expect(result.score).toBeDefined()
    })
  })

  describe("deleteExam", () => {
    it("supprime les participations et réponses associées", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      // Accorder l'accès exam à l'utilisateur
      await grantAccess(t, user.userId, "exam")

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen à supprimer",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],

      })

      // Participer à l'examen
      await user.asUser.mutation(api.exams.startExam, { examId })
      await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [{ questionId, selectedAnswer: "A" }],
      })

      // Supprimer l'examen
      const result = await admin.asAdmin.mutation(api.exams.deleteExam, { examId })

      expect(result.success).toBe(true)
      expect(result.deletedParticipations).toBe(1)
    })
  })

  describe("getMyScoreHistory", () => {
    it("retourne une liste vide si non authentifié", async () => {
      const t = convexTest(schema, modules)
      const history = await t.query(api.exams.getMyScoreHistory)
      expect(history).toEqual([])
    })

    it("retourne une liste vide si aucun examen complété", async () => {
      const t = convexTest(schema, modules)
      const user = await createRegularUser(t)

      const history = await user.asUser.query(api.exams.getMyScoreHistory)
      expect(history).toEqual([])
    })

    it("retourne l'historique trié par date de completion", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      await grantAccess(t, user.userId, "exam")

      const q1 = await admin.asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "D1",
      })

      const now = Date.now()

      // Create first exam
      const exam1 = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen 1",
        startDate: now - 2000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1],

      })

      // Create second exam
      const exam2 = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen 2",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1],

      })

      // Complete exam1 first (100%)
      await user.asUser.mutation(api.exams.startExam, { examId: exam1 })
      await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId: exam1,
        answers: [{ questionId: q1, selectedAnswer: "A" }],
        correctAnswers: { [q1]: "A" },
      })

      // Complete exam2 second (0%)
      await user.asUser.mutation(api.exams.startExam, { examId: exam2 })
      await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId: exam2,
        answers: [{ questionId: q1, selectedAnswer: "B" }],
        correctAnswers: { [q1]: "A" },
      })

      const history = await user.asUser.query(api.exams.getMyScoreHistory)

      expect(history).toHaveLength(2)
      // Sorted by completion date ascending (oldest first)
      expect(history[0].examTitle).toBe("Examen 1")
      expect(history[0].score).toBe(100)
      expect(history[1].examTitle).toBe("Examen 2")
      expect(history[1].score).toBe(0)
    })

    it("limite à 10 résultats maximum", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      await grantAccess(t, user.userId, "exam")

      const q1 = await admin.asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "D1",
      })

      const now = Date.now()

      // Create and complete 12 exams
      for (let i = 1; i <= 12; i++) {
        const examId = await admin.asAdmin.mutation(api.exams.createExam, {
          title: `Examen ${i}`,
          startDate: now - 1000,
          endDate: now + 7 * 24 * 60 * 60 * 1000,
          questionIds: [q1],

        })

        await user.asUser.mutation(api.exams.startExam, { examId })
        await user.asUser.mutation(api.exams.submitExamAnswers, {
          examId,
          answers: [{ questionId: q1, selectedAnswer: "A" }],
          correctAnswers: { [q1]: "A" },
        })
      }

      const history = await user.asUser.query(api.exams.getMyScoreHistory)
      expect(history).toHaveLength(10)
    })

    it("inclut les examens auto_submitted", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      await grantAccess(t, user.userId, "exam")

      const q1 = await admin.asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "D1",
      })

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen auto-soumis",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1],

      })

      await user.asUser.mutation(api.exams.startExam, { examId })

      // Submit with isAutoSubmit flag
      await user.asUser.mutation(api.exams.submitExamAnswers, {
        examId,
        answers: [{ questionId: q1, selectedAnswer: "A" }],
        correctAnswers: { [q1]: "A" },
        isAutoSubmit: true,
      })

      const history = await user.asUser.query(api.exams.getMyScoreHistory)
      expect(history).toHaveLength(1)
      expect(history[0].examTitle).toBe("Examen auto-soumis")
    })

    it("n'inclut pas les examens in_progress", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      await grantAccess(t, user.userId, "exam")

      const q1 = await admin.asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "D1",
      })

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen en cours",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [q1],

      })

      // Start but don't complete
      await user.asUser.mutation(api.exams.startExam, { examId })

      const history = await user.asUser.query(api.exams.getMyScoreHistory)
      expect(history).toHaveLength(0)
    })
  })

  describe("closeExpiredParticipations", () => {
    it("retourne closedCount=0 si aucune participation in_progress", async () => {
      const t = convexTest(schema, modules)

      const result = await t.mutation(
        internal.exams.closeExpiredParticipations,
        {},
      )

      expect(result.closedCount).toBe(0)
      expect(result.processedCount).toBe(0)
    })

    it("ferme les participations in_progress des examens expirés", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      const now = Date.now()

      // Create a question (using correct schema)
      const questionId = await t.run(async (ctx) => {
        return await ctx.db.insert("questions", {
          question: "Test question",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "Test",
          objectifCMC: "Test",
          domain: "Test",
        })
      })

      // Create an expired exam
      const examId = await t.run(async (ctx) => {
        return await ctx.db.insert("exams", {
          title: "Examen expiré",
          startDate: now - 2 * 24 * 60 * 60 * 1000,
          endDate: now - 1000, // Just expired
          questionIds: [questionId],
          completionTime: 83,

          isActive: true,
          createdBy: admin.userId,
        })
      })

      // Create an in_progress participation
      const participationId = await t.run(async (ctx) => {
        return await ctx.db.insert("examParticipations", {
          examId,
          userId: user.userId,
          startedAt: now - 1 * 24 * 60 * 60 * 1000,
          status: "in_progress",
          score: 0,
          completedAt: 0,
        })
      })

      // Add an answer
      await t.run(async (ctx) => {
        await ctx.db.insert("examAnswers", {
          participationId,
          questionId,
          selectedAnswer: "A",
          isCorrect: true,
        })
      })

      // Run the cron job
      const result = await t.mutation(
        internal.exams.closeExpiredParticipations,
        {},
      )

      expect(result.closedCount).toBe(1)
      expect(result.processedCount).toBe(1)

      // Verify the participation was updated
      const participation = await t.run(async (ctx) => {
        return await ctx.db.get(participationId)
      })

      expect(participation?.status).toBe("auto_submitted")
      expect(participation?.score).toBe(100) // 1 correct out of 1
      expect(participation?.completedAt).toBeGreaterThan(0)
    })

    it("ne ferme pas les participations des examens non expirés", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      await grantAccess(t, user.userId, "exam")

      const q1 = await admin.asAdmin.mutation(api.questions.createQuestion, {
        question: "Q1",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E1",
        objectifCMC: "O1",
        domain: "D1",
      })

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen actif",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000, // Not expired
        questionIds: [q1],

      })

      await user.asUser.mutation(api.exams.startExam, { examId })

      // Run the cron job
      const result = await t.mutation(
        internal.exams.closeExpiredParticipations,
        {},
      )

      expect(result.closedCount).toBe(0)
      expect(result.processedCount).toBe(1) // Processed but not closed

      // Verify participation is still in_progress
      const session = await user.asUser.query(api.exams.getExamSession, {
        examId,
      })
      expect(session?.status).toBe("in_progress")
    })

    it("calcule le score basé sur les réponses existantes", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)

      const now = Date.now()

      // Create two questions (using correct schema)
      const q1 = await t.run(async (ctx) => {
        return await ctx.db.insert("questions", {
          question: "Q1",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "E1",
          objectifCMC: "O1",
          domain: "Test",
        })
      })

      const q2 = await t.run(async (ctx) => {
        return await ctx.db.insert("questions", {
          question: "Q2",
          options: ["A", "B", "C", "D"],
          correctAnswer: "B",
          explanation: "E2",
          objectifCMC: "O2",
          domain: "Test",
        })
      })

      // Create expired exam with 2 questions
      const examId = await t.run(async (ctx) => {
        return await ctx.db.insert("exams", {
          title: "Examen expiré",
          startDate: now - 2 * 24 * 60 * 60 * 1000,
          endDate: now - 1000,
          questionIds: [q1, q2],
          completionTime: 166,

          isActive: true,
          createdBy: admin.userId,
        })
      })

      const participationId = await t.run(async (ctx) => {
        return await ctx.db.insert("examParticipations", {
          examId,
          userId: user.userId,
          startedAt: now - 1 * 24 * 60 * 60 * 1000,
          status: "in_progress",
          score: 0,
          completedAt: 0,
        })
      })

      // Add 1 correct answer out of 2 questions
      await t.run(async (ctx) => {
        await ctx.db.insert("examAnswers", {
          participationId,
          questionId: q1,
          selectedAnswer: "A",
          isCorrect: true,
        })
        await ctx.db.insert("examAnswers", {
          participationId,
          questionId: q2,
          selectedAnswer: "C", // Wrong
          isCorrect: false,
        })
      })

      // Run the cron job
      await t.mutation(internal.exams.closeExpiredParticipations, {})

      // Verify score is 50% (1/2)
      const participation = await t.run(async (ctx) => {
        return await ctx.db.get(participationId)
      })

      expect(participation?.score).toBe(50)
      expect(participation?.status).toBe("auto_submitted")
    })

    it("gère correctement plusieurs participations expirées", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")

      const now = Date.now()

      // Create a question (using correct schema)
      const questionId = await t.run(async (ctx) => {
        return await ctx.db.insert("questions", {
          question: "Test question",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "Test",
          objectifCMC: "Test",
          domain: "Test",
        })
      })

      // Create expired exam
      const examId = await t.run(async (ctx) => {
        return await ctx.db.insert("exams", {
          title: "Examen expiré",
          startDate: now - 2 * 24 * 60 * 60 * 1000,
          endDate: now - 1000,
          questionIds: [questionId],
          completionTime: 83,

          isActive: true,
          createdBy: admin.userId,
        })
      })

      // Create in_progress participations for both users
      await t.run(async (ctx) => {
        await ctx.db.insert("examParticipations", {
          examId,
          userId: user1.userId,
          startedAt: now - 1 * 24 * 60 * 60 * 1000,
          status: "in_progress",
          score: 0,
          completedAt: 0,
        })
        await ctx.db.insert("examParticipations", {
          examId,
          userId: user2.userId,
          startedAt: now - 1 * 24 * 60 * 60 * 1000,
          status: "in_progress",
          score: 0,
          completedAt: 0,
        })
      })

      // Run the cron job
      const result = await t.mutation(
        internal.exams.closeExpiredParticipations,
        {},
      )

      expect(result.closedCount).toBe(2)
      expect(result.processedCount).toBe(2)
    })
  })
})
