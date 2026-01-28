import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api } from "../../convex/_generated/api"
import { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

// Import des modules Convex pour convexTest (Vite spécifique)
const modules = import.meta.glob("../../convex/**/*.ts")

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
  admin: Awaited<ReturnType<typeof createAdminUser>>,
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

// Helper pour créer un examen
const createExam = async (
  t: ReturnType<typeof convexTest>,
  admin: Awaited<ReturnType<typeof createAdminUser>>,
  questionIds: Id<"questions">[],
) => {
  return await admin.asAdmin.mutation(api.exams.createExam, {
    title: "Examen Test",
    description: "Description",
    startDate: Date.now(),
    endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    questionIds,
  })
}

// Helper pour accorder l'accès exam à un utilisateur
const grantExamAccess = async (
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
) => {
  await t.run(async (ctx) => {
    // Créer un produit
    const productId = await ctx.db.insert("products", {
      code: "exam_access",
      name: "Accès Examens",
      description: "Test product",
      priceCAD: 5000,
      durationDays: 30,
      accessType: "exam",
      stripeProductId: "prod_test_exam",
      stripePriceId: "price_test_exam",
      isActive: true,
    })

    // Créer une transaction
    const transactionId = await ctx.db.insert("transactions", {
      userId,
      productId,
      type: "manual",
      status: "completed",
      amountPaid: 0,
      currency: "CAD",
      accessType: "exam",
      durationDays: 30,
      accessExpiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
    })

    // Créer l'accès utilisateur
    await ctx.db.insert("userAccess", {
      userId,
      accessType: "exam",
      expiresAt: Date.now() + 86400000,
      lastTransactionId: transactionId,
    })
  })
}

// Helper pour récupérer une participation par exam et user (remplace la fonction supprimée)
const getParticipationByExamUser = async (
  t: ReturnType<typeof convexTest>,
  examId: Id<"exams">,
  userId: Id<"users">,
) => {
  return await t.run(async (ctx) => {
    const participations = await ctx.db.query("examParticipations").collect()
    return participations.find(
      (p) => p.examId === examId && p.userId === userId,
    ) ?? null
  })
}

// Helper pour récupérer les réponses (remplace la fonction supprimée)
const getAnswersByParticipation = async (
  t: ReturnType<typeof convexTest>,
  participationId: Id<"examParticipations">,
) => {
  return await t.run(async (ctx) => {
    const answers = await ctx.db.query("examAnswers").collect()
    return answers.filter((a) => a.participationId === participationId)
  })
}

describe("examParticipations", () => {
  it("gère le cycle de vie complet d'une participation", async () => {
    const t = convexTest(schema, modules)
    const admin = await createAdminUser(t)
    const user = await createRegularUser(t)
    const questionId = await createQuestion(t, admin)
    const examId = await createExam(t, admin, [questionId])

    // Accorder l'accès exam à l'utilisateur
    await grantExamAccess(t, user.userId)

    // 1. Créer une participation (Démarrer l'examen)
    // Note: userId is no longer passed - derived from authenticated user
    const participationId = await user.asUser.mutation(
      api.examParticipations.create,
      { examId },
    )

    expect(participationId).toBeDefined()

    const participation = await getParticipationByExamUser(t, examId, user.userId)
    expect(participation?.status).toBe("in_progress")
    expect(participation?.startedAt).toBeGreaterThan(0)

    // 2. Sauvegarder une réponse
    await user.asUser.mutation(api.examParticipations.saveAnswer, {
      participationId,
      questionId,
      selectedAnswer: "A",
      isCorrect: true,
    })

    const answers = await getAnswersByParticipation(t, participationId)
    expect(answers).toHaveLength(1)
    expect(answers[0].selectedAnswer).toBe("A")
    expect(answers[0].isCorrect).toBe(true)

    // 3. Mettre à jour la phase de pause
    await user.asUser.mutation(api.examParticipations.updatePausePhase, {
      participationId,
      pausePhase: "during_pause",
      pauseStartedAt: Date.now(),
    })

    const updatedParticipation = await getParticipationByExamUser(t, examId, user.userId)
    expect(updatedParticipation?.pausePhase).toBe("during_pause")
    expect(updatedParticipation?.pauseStartedAt).toBeDefined()

    // 4. Terminer l'examen
    await user.asUser.mutation(api.examParticipations.complete, {
      participationId,
      score: 100,
      status: "completed",
    })

    const finalParticipation = await getParticipationByExamUser(t, examId, user.userId)
    expect(finalParticipation?.status).toBe("completed")
    expect(finalParticipation?.score).toBe(100)
    expect(finalParticipation?.completedAt).toBeGreaterThan(0)
  })

  it("permet à un admin de supprimer une participation", async () => {
    const t = convexTest(schema, modules)
    const admin = await createAdminUser(t)
    const user = await createRegularUser(t)
    const questionId = await createQuestion(t, admin)
    const examId = await createExam(t, admin, [questionId])

    // Accorder l'accès exam à l'utilisateur
    await grantExamAccess(t, user.userId)

    const participationId = await user.asUser.mutation(
      api.examParticipations.create,
      { examId },
    )

    // Tentative de suppression par un utilisateur non-admin
    await expect(
      user.asUser.mutation(api.examParticipations.deleteParticipation, {
        participationId,
      }),
    ).rejects.toThrow("Accès non autorisé")

    // Suppression par l'admin
    await admin.asAdmin.mutation(api.examParticipations.deleteParticipation, {
      participationId,
    })

    const participation = await getParticipationByExamUser(t, examId, user.userId)
    expect(participation).toBeNull()

    const answers = await getAnswersByParticipation(t, participationId)
    expect(answers).toHaveLength(0)
  })

  it("gère la sauvegarde par lot (batch) des réponses", async () => {
    const t = convexTest(schema, modules)
    const admin = await createAdminUser(t)
    const user = await createRegularUser(t)
    const q1 = await createQuestion(t, admin, 1)
    const q2 = await createQuestion(t, admin, 2)
    const examId = await createExam(t, admin, [q1, q2])

    // Accorder l'accès exam à l'utilisateur
    await grantExamAccess(t, user.userId)

    const participationId = await user.asUser.mutation(
      api.examParticipations.create,
      { examId },
    )

    await user.asUser.mutation(api.examParticipations.saveAnswersBatch, {
      participationId,
      answers: [
        { questionId: q1, selectedAnswer: "A", isCorrect: true },
        { questionId: q2, selectedAnswer: "B", isCorrect: false },
      ],
    })

    const answers = await getAnswersByParticipation(t, participationId)
    expect(answers).toHaveLength(2)
    expect(answers.find((a) => a.questionId === q1)?.isCorrect).toBe(true)
    expect(answers.find((a) => a.questionId === q2)?.isCorrect).toBe(false)
  })

  // ============================================
  // TESTS DE SÉCURITÉ - Authorization
  // ============================================

  describe("Authorization Tests", () => {
    it("saveAnswer rejette les modifications des participations d'autres utilisateurs", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId])

      // Accorder l'accès exam à user1
      await grantExamAccess(t, user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId },
      )

      // User2 essayant de sauvegarder une réponse sur la participation de User1
      await expect(
        user2.asUser.mutation(api.examParticipations.saveAnswer, {
          participationId,
          questionId,
          selectedAnswer: "B",
          isCorrect: false,
        }),
      ).rejects.toThrow("Vous ne pouvez pas modifier cette participation")
    })

    it("saveAnswersBatch rejette les modifications des participations d'autres utilisateurs", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId])

      // Accorder l'accès exam à user1
      await grantExamAccess(t, user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId },
      )

      // User2 essayant de sauvegarder des réponses sur la participation de User1
      await expect(
        user2.asUser.mutation(api.examParticipations.saveAnswersBatch, {
          participationId,
          answers: [{ questionId, selectedAnswer: "B", isCorrect: false }],
        }),
      ).rejects.toThrow("Vous ne pouvez pas modifier cette participation")
    })

    it("create rejette la création de participation pour un autre utilisateur (non-admin)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId])

      // Accorder l'accès exam à user1 (pour que la création soit possible par les bonnes personnes)
      await grantExamAccess(t, user1.userId)

      // User2 essayant de créer une participation pour User1 using forUserId
      await expect(
        user2.asUser.mutation(api.examParticipations.create, {
          examId,
          forUserId: user1.userId,
        }),
      ).rejects.toThrow(
        "Vous ne pouvez pas créer une participation pour un autre utilisateur",
      )
    })

    it("create permet à un admin de créer une participation pour un autre utilisateur", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId])

      // Accorder l'accès exam à l'utilisateur
      await grantExamAccess(t, user.userId)

      // Admin crée une participation pour l'utilisateur
      const participationId = await admin.asAdmin.mutation(
        api.examParticipations.create,
        {
          examId,
          forUserId: user.userId,
        },
      )

      expect(participationId).toBeDefined()
      const participation = await getParticipationByExamUser(t, examId, user.userId)
      expect(participation?.userId).toBe(user.userId)
    })

    it("complete rejette la modification par un autre utilisateur", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId])

      // Accorder l'accès exam à user1
      await grantExamAccess(t, user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId },
      )

      // User2 essayant de compléter la participation de User1
      await expect(
        user2.asUser.mutation(api.examParticipations.complete, {
          participationId,
          score: 100,
        }),
      ).rejects.toThrow("Vous ne pouvez pas modifier cette participation")
    })

    it("complete valide la plage de score (0-100)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId])

      // Accorder l'accès exam à l'utilisateur
      await grantExamAccess(t, user.userId)

      const participationId = await user.asUser.mutation(
        api.examParticipations.create,
        { examId },
      )

      // Score invalide (> 100)
      await expect(
        user.asUser.mutation(api.examParticipations.complete, {
          participationId,
          score: 150,
        }),
      ).rejects.toThrow("Le score doit être entre 0 et 100")

      // Score invalide (< 0)
      await expect(
        user.asUser.mutation(api.examParticipations.complete, {
          participationId,
          score: -10,
        }),
      ).rejects.toThrow("Le score doit être entre 0 et 100")
    })

    it("updatePausePhase rejette la modification par un autre utilisateur", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId])

      // Accorder l'accès exam à user1
      await grantExamAccess(t, user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId },
      )

      // User2 essayant de modifier la phase de pause de User1
      await expect(
        user2.asUser.mutation(api.examParticipations.updatePausePhase, {
          participationId,
          pausePhase: "during_pause",
        }),
      ).rejects.toThrow("Vous ne pouvez pas modifier cette participation")
    })

    it("saveAnswer rejette les modifications après completion", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId])

      // Accorder l'accès exam à l'utilisateur
      await grantExamAccess(t, user.userId)

      const participationId = await user.asUser.mutation(
        api.examParticipations.create,
        { examId },
      )

      // Compléter la participation
      await user.asUser.mutation(api.examParticipations.complete, {
        participationId,
        score: 80,
      })

      // Essayer de modifier une réponse après completion
      await expect(
        user.asUser.mutation(api.examParticipations.saveAnswer, {
          participationId,
          questionId,
          selectedAnswer: "C",
          isCorrect: false,
        }),
      ).rejects.toThrow("Cette participation n'est plus modifiable")
    })
  })
})
