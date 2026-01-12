import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import schema from "./schema"

// Import des modules Convex pour convexTest (Vite spécifique)
const modules = import.meta.glob("./**/*.ts")

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
  userId: Id<"users">,
) => {
  return await admin.asAdmin.mutation(api.exams.createExam, {
    title: "Examen Test",
    description: "Description",
    startDate: Date.now(),
    endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    questionIds,
    allowedParticipants: [userId],
  })
}

describe("examParticipations", () => {
  it("gère le cycle de vie complet d'une participation", async () => {
    const t = convexTest(schema, modules)
    const admin = await createAdminUser(t)
    const user = await createRegularUser(t)
    const questionId = await createQuestion(t, admin)
    const examId = await createExam(t, admin, [questionId], user.userId)

    // 1. Créer une participation (Démarrer l'examen)
    const participationId = await user.asUser.mutation(
      api.examParticipations.create,
      {
        examId,
        userId: user.userId,
      },
    )

    expect(participationId).toBeDefined()

    const participation = await user.asUser.query(
      api.examParticipations.getByExamAndUser,
      {
        examId,
        userId: user.userId,
      },
    )
    expect(participation?.status).toBe("in_progress")
    expect(participation?.startedAt).toBeGreaterThan(0)

    // 2. Sauvegarder une réponse
    await user.asUser.mutation(api.examParticipations.saveAnswer, {
      participationId,
      questionId,
      selectedAnswer: "A",
      isCorrect: true,
    })

    const answers = await user.asUser.query(api.examParticipations.getAnswers, {
      participationId,
    })
    expect(answers).toHaveLength(1)
    expect(answers[0].selectedAnswer).toBe("A")
    expect(answers[0].isCorrect).toBe(true)

    // 3. Mettre à jour la phase de pause
    await user.asUser.mutation(api.examParticipations.updatePausePhase, {
      participationId,
      pausePhase: "during_pause",
      pauseStartedAt: Date.now(),
    })

    const updatedParticipation = await user.asUser.query(
      api.examParticipations.getByExamAndUser,
      {
        examId,
        userId: user.userId,
      },
    )
    expect(updatedParticipation?.pausePhase).toBe("during_pause")
    expect(updatedParticipation?.pauseStartedAt).toBeDefined()

    // 4. Terminer l'examen
    await user.asUser.mutation(api.examParticipations.complete, {
      participationId,
      score: 100,
      status: "completed",
    })

    const finalParticipation = await user.asUser.query(
      api.examParticipations.getByExamAndUser,
      {
        examId,
        userId: user.userId,
      },
    )
    expect(finalParticipation?.status).toBe("completed")
    expect(finalParticipation?.score).toBe(100)
    expect(finalParticipation?.completedAt).toBeGreaterThan(0)
  })

  it("permet à un admin de supprimer une participation", async () => {
    const t = convexTest(schema, modules)
    const admin = await createAdminUser(t)
    const user = await createRegularUser(t)
    const questionId = await createQuestion(t, admin)
    const examId = await createExam(t, admin, [questionId], user.userId)

    const participationId = await user.asUser.mutation(
      api.examParticipations.create,
      {
        examId,
        userId: user.userId,
      },
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

    const participation = await user.asUser.query(
      api.examParticipations.getByExamAndUser,
      {
        examId,
        userId: user.userId,
      },
    )
    expect(participation).toBeNull()

    const answers = await user.asUser.query(api.examParticipations.getAnswers, {
      participationId,
    })
    expect(answers).toHaveLength(0)
  })

  it("gère la sauvegarde par lot (batch) des réponses", async () => {
    const t = convexTest(schema, modules)
    const admin = await createAdminUser(t)
    const user = await createRegularUser(t)
    const q1 = await createQuestion(t, admin, 1)
    const q2 = await createQuestion(t, admin, 2)
    const examId = await createExam(t, admin, [q1, q2], user.userId)

    const participationId = await user.asUser.mutation(
      api.examParticipations.create,
      {
        examId,
        userId: user.userId,
      },
    )

    await user.asUser.mutation(api.examParticipations.saveAnswersBatch, {
      participationId,
      answers: [
        { questionId: q1, selectedAnswer: "A", isCorrect: true },
        { questionId: q2, selectedAnswer: "B", isCorrect: false },
      ],
    })

    const answers = await user.asUser.query(api.examParticipations.getAnswers, {
      participationId,
    })
    expect(answers).toHaveLength(2)
    expect(answers.find((a) => a.questionId === q1)?.isCorrect).toBe(true)
    expect(answers.find((a) => a.questionId === q2)?.isCorrect).toBe(false)
  })

  // ============================================
  // TESTS DE SÉCURITÉ - Authorization
  // ============================================

  describe("Authorization Tests", () => {
    it("getByExam rejette les non-admins", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId], user.userId)

      // L'utilisateur démarre l'examen
      await user.asUser.mutation(api.examParticipations.create, {
        examId,
        userId: user.userId,
      })

      // Non-admin devrait recevoir un array vide
      const result = await user.asUser.query(api.examParticipations.getByExam, {
        examId,
      })
      expect(result).toHaveLength(0)

      // Admin devrait voir les participations
      const adminResult = await admin.asAdmin.query(
        api.examParticipations.getByExam,
        { examId },
      )
      expect(adminResult).toHaveLength(1)
    })

    it("getByUser rejette les requêtes pour d'autres utilisateurs", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId], user1.userId)

      await user1.asUser.mutation(api.examParticipations.create, {
        examId,
        userId: user1.userId,
      })

      // User2 essayant de voir l'historique de User1 devrait recevoir un array vide
      const result = await user2.asUser.query(api.examParticipations.getByUser, {
        userId: user1.userId,
      })
      expect(result).toHaveLength(0)

      // User1 peut voir son propre historique
      const ownResult = await user1.asUser.query(
        api.examParticipations.getByUser,
        { userId: user1.userId },
      )
      expect(ownResult).toHaveLength(1)

      // Admin peut voir l'historique de n'importe qui
      const adminResult = await admin.asAdmin.query(
        api.examParticipations.getByUser,
        { userId: user1.userId },
      )
      expect(adminResult).toHaveLength(1)
    })

    it("getWithAnswers protège les données des autres utilisateurs", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId], user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId, userId: user1.userId },
      )

      // User2 ne devrait pas voir la participation de User1
      const result = await user2.asUser.query(
        api.examParticipations.getWithAnswers,
        { participationId },
      )
      expect(result).toBeNull()

      // User1 peut voir sa propre participation
      const ownResult = await user1.asUser.query(
        api.examParticipations.getWithAnswers,
        { participationId },
      )
      expect(ownResult).not.toBeNull()
      expect(ownResult?._id).toBe(participationId)
    })

    it("getAnswers protège les réponses des autres utilisateurs", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId], user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId, userId: user1.userId },
      )

      await user1.asUser.mutation(api.examParticipations.saveAnswer, {
        participationId,
        questionId,
        selectedAnswer: "A",
        isCorrect: true,
      })

      // User2 ne devrait pas voir les réponses
      const result = await user2.asUser.query(api.examParticipations.getAnswers, {
        participationId,
      })
      expect(result).toHaveLength(0)

      // User1 peut voir ses propres réponses
      const ownResult = await user1.asUser.query(
        api.examParticipations.getAnswers,
        { participationId },
      )
      expect(ownResult).toHaveLength(1)
    })

    it("saveAnswer rejette les modifications des participations d'autres utilisateurs", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId], user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId, userId: user1.userId },
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
      const examId = await createExam(t, admin, [questionId], user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId, userId: user1.userId },
      )

      // User2 essayant de sauvegarder des réponses sur la participation de User1
      await expect(
        user2.asUser.mutation(api.examParticipations.saveAnswersBatch, {
          participationId,
          answers: [{ questionId, selectedAnswer: "B", isCorrect: false }],
        }),
      ).rejects.toThrow("Vous ne pouvez pas modifier cette participation")
    })

    it("create rejette la création de participation pour un autre utilisateur", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId], user1.userId)

      // User2 essayant de créer une participation pour User1
      await expect(
        user2.asUser.mutation(api.examParticipations.create, {
          examId,
          userId: user1.userId,
        }),
      ).rejects.toThrow(
        "Vous ne pouvez pas créer une participation pour un autre utilisateur",
      )
    })

    it("complete rejette la modification par un autre utilisateur", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)
      const examId = await createExam(t, admin, [questionId], user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId, userId: user1.userId },
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
      const examId = await createExam(t, admin, [questionId], user.userId)

      const participationId = await user.asUser.mutation(
        api.examParticipations.create,
        { examId, userId: user.userId },
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
      const examId = await createExam(t, admin, [questionId], user1.userId)

      const participationId = await user1.asUser.mutation(
        api.examParticipations.create,
        { examId, userId: user1.userId },
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
      const examId = await createExam(t, admin, [questionId], user.userId)

      const participationId = await user.asUser.mutation(
        api.examParticipations.create,
        { examId, userId: user.userId },
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
