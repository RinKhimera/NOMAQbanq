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
})
