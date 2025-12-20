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
      const { asUser, userId } = await createRegularUser(t)

      await expect(
        asUser.mutation(api.exams.createExam, {
          title: "Examen Test",
          startDate: Date.now(),
          endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
          questionIds: [],
          allowedParticipants: [userId],
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("crée un examen avec succès", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen EACMC",
        description: "Description de l'examen",
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [user.userId],
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
        allowedParticipants: [],
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
        allowedParticipants: [],
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
        allowedParticipants: [],
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
        allowedParticipants: [],
      })

      await admin.asAdmin.mutation(api.exams.updateExam, {
        examId,
        title: "Titre modifié",
        description: "Nouvelle description",
        startDate: Date.now(),
        endDate: Date.now() + 14 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [],
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
        allowedParticipants: [],
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
        allowedParticipants: [],
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

  describe("getActiveExams", () => {
    it("retourne uniquement les examens actifs et dans la période", async () => {
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
        allowedParticipants: [user.userId],
      })

      // Examen pas encore commencé
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen futur",
        startDate: now + 24 * 60 * 60 * 1000,
        endDate: now + 14 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [user.userId],
      })

      // Examen terminé
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen passé",
        startDate: now - 14 * 24 * 60 * 60 * 1000,
        endDate: now - 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [user.userId],
      })

      const activeExams = await user.asUser.query(api.exams.getActiveExams)
      expect(activeExams).toHaveLength(1)
      expect(activeExams[0].title).toBe("Examen actif")
    })

    it("filtre par participants autorisés pour les utilisateurs non-admin", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)

      const now = Date.now()

      // Examen pour user1 seulement
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen pour user1",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [user1.userId],
      })

      // User1 devrait voir l'examen
      const user1Exams = await user1.asUser.query(api.exams.getActiveExams)
      expect(user1Exams).toHaveLength(1)

      // User2 ne devrait pas voir l'examen
      const user2Exams = await user2.asUser.query(api.exams.getActiveExams)
      expect(user2Exams).toHaveLength(0)
    })
  })

  describe("startExam", () => {
    it("démarre une session d'examen", async () => {
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
        allowedParticipants: [user.userId],
      })

      const result = await user.asUser.mutation(api.exams.startExam, { examId })
      expect(result.startedAt).toBeDefined()

      // Vérifier la session
      const session = await user.asUser.query(api.exams.getExamSession, {
        examId,
      })
      expect(session?.status).toBe("in_progress")
    })

    it("rejette si l'utilisateur n'est pas autorisé", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user1 = await createRegularUser(t, "1")
      const user2 = await createRegularUser(t, "2")
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [user1.userId], // Seulement user1
      })

      await expect(
        user2.asUser.mutation(api.exams.startExam, { examId }),
      ).rejects.toThrow("Vous n'êtes pas autorisé à passer cet examen")
    })

    it("rejette si l'examen n'est pas disponible", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const user = await createRegularUser(t)
      const questionId = await createQuestion(t, admin)

      const now = Date.now()
      // Examen dans le futur
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen futur",
        startDate: now + 24 * 60 * 60 * 1000,
        endDate: now + 14 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [user.userId],
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

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen avec pause",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [user.userId],
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
        allowedParticipants: [user.userId],
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
        allowedParticipants: [user.userId],
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

      const now = Date.now()
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [user.userId],
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
        allowedParticipants: [user1.userId, user2.userId],
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

      const leaderboard = await t.query(api.exams.getExamLeaderboard, {
        examId,
      })
      expect(leaderboard).toHaveLength(2)
      expect(leaderboard[0].score).toBe(100)
      expect(leaderboard[1].score).toBe(0)
    })
  })

  describe("getAllExamsMetadata", () => {
    it("retourne les métadonnées sans les données lourdes", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionId = await createQuestion(t, admin)

      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen Test",
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [],
      })

      const metadata = await t.query(api.exams.getAllExamsMetadata)
      expect(metadata).toHaveLength(1)
      expect(metadata[0].questionCount).toBe(1)
      expect(metadata[0].participantCount).toBe(0)
      // Vérifier que les arrays lourds ne sont pas inclus
      expect(
        (metadata[0] as Record<string, unknown>).questionIds,
      ).toBeUndefined()
      expect(
        (metadata[0] as Record<string, unknown>).participants,
      ).toBeUndefined()
    })
  })
})
