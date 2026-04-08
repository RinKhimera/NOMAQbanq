import { convexTest } from "convex-test"
import { beforeEach, describe, expect, it } from "vitest"
import { api, internal } from "../../convex/_generated/api"
import schema from "../../convex/schema"
import {
  clearProductCache,
  createAdminUser,
  createQuestions,
  createRegularUser,
  grantTrainingAccess,
} from "../helpers/convex-helpers"

const modules = import.meta.glob("../../convex/**/*.ts")

describe("training", () => {
  beforeEach(() => {
    clearProductCache()
  })

  // ============================================
  // createTrainingSession
  // ============================================
  describe("createTrainingSession", () => {
    it("cree une session avec acces valide", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 10)
      await grantTrainingAccess(t, userId)

      const result = await asUser.mutation(api.training.createTrainingSession, {
        questionCount: 5,
      })

      expect(result.sessionId).toBeDefined()
      expect(result.questionIds).toHaveLength(5)
      expect(result.expiresAt).toBeGreaterThan(Date.now())
    })

    it("rejette un utilisateur non authentifie", async () => {
      const t = convexTest(schema, modules)

      await expect(
        t.mutation(api.training.createTrainingSession, { questionCount: 5 }),
      ).rejects.toThrow()
    })

    it("rejette un utilisateur sans acces training", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 10)

      await expect(
        asUser.mutation(api.training.createTrainingSession, {
          questionCount: 5,
        }),
      ).rejects.toThrow("expiré")
    })

    it("rejette un utilisateur avec acces expire", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 10)

      // Accorder un acces deja expire
      const productId = await t.run(async (ctx) => {
        return ctx.db.insert("products", {
          code: "training_access",
          name: "Acces Entrainement",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "training",
          stripeProductId: "prod_test",
          stripePriceId: "price_test",
          isActive: true,
        })
      })

      await t.run(async (ctx) => {
        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 0,
          currency: "CAD",
          accessType: "training",
          durationDays: 30,
          accessExpiresAt: Date.now() - 1000,
          createdAt: Date.now(),
        })
        await ctx.db.insert("userAccess", {
          userId,
          accessType: "training",
          expiresAt: Date.now() - 1000, // Expire
          lastTransactionId: txId,
        })
      })

      await expect(
        asUser.mutation(api.training.createTrainingSession, {
          questionCount: 5,
        }),
      ).rejects.toThrow("expiré")
    })

    it("admin bypass la verification d'acces", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 10)

      const result = await admin.asAdmin.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      expect(result.sessionId).toBeDefined()
    })

    it("rejette questionCount < 5", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 10)

      await expect(
        admin.asAdmin.mutation(api.training.createTrainingSession, {
          questionCount: 4,
        }),
      ).rejects.toThrow("entre 5 et 20")
    })

    it("rejette questionCount > 20", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 25)

      await expect(
        admin.asAdmin.mutation(api.training.createTrainingSession, {
          questionCount: 21,
        }),
      ).rejects.toThrow("entre 5 et 20")
    })

    it("rejette questionCount non entier", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 10)

      await expect(
        admin.asAdmin.mutation(api.training.createTrainingSession, {
          questionCount: 5.5,
        }),
      ).rejects.toThrow("entre 5 et 20")
    })

    it("accepte questionCount = 5 (borne min)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 10)

      const result = await admin.asAdmin.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )
      expect(result.questionIds).toHaveLength(5)
    })

    it("accepte questionCount = 20 (borne max)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 20)

      const result = await admin.asAdmin.mutation(
        api.training.createTrainingSession,
        { questionCount: 20 },
      )
      expect(result.questionIds).toHaveLength(20)
    })

    it("rate limiting: rejette apres 10 sessions par heure (non-admin)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 10)
      await grantTrainingAccess(t, userId)

      // Creer 10 sessions manuellement (completed pour ne pas bloquer)
      for (let i = 0; i < 10; i++) {
        await t.run(async (ctx) => {
          await ctx.db.insert("trainingParticipations", {
            userId,
            questionCount: 5,
            questionIds: [],
            score: 0,
            status: "completed",
            startedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          })
        })
      }

      await expect(
        asUser.mutation(api.training.createTrainingSession, {
          questionCount: 5,
        }),
      ).rejects.toThrow()
    })

    it("admin bypass le rate limiting", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 10)

      // Creer 10 sessions
      for (let i = 0; i < 10; i++) {
        await t.run(async (ctx) => {
          await ctx.db.insert("trainingParticipations", {
            userId: admin.userId,
            questionCount: 5,
            questionIds: [],
            score: 0,
            status: "completed",
            startedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          })
        })
      }

      const result = await admin.asAdmin.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )
      expect(result.sessionId).toBeDefined()
    })

    it("rejette si session en cours non expiree", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 10)

      await admin.asAdmin.mutation(api.training.createTrainingSession, {
        questionCount: 5,
      })

      await expect(
        admin.asAdmin.mutation(api.training.createTrainingSession, {
          questionCount: 5,
        }),
      ).rejects.toThrow("session en cours")
    })

    it("abandonne la session expiree et en cree une nouvelle", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 10)

      // Creer une session expiree
      await t.run(async (ctx) => {
        await ctx.db.insert("trainingParticipations", {
          userId: admin.userId,
          questionCount: 5,
          questionIds: [],
          score: 0,
          status: "in_progress",
          startedAt: Date.now() - 86400001,
          expiresAt: Date.now() - 1000, // Expiree
        })
      })

      const result = await admin.asAdmin.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )
      expect(result.sessionId).toBeDefined()

      // Verifier que l'ancienne session est abandonnee
      const sessions = await t.run(async (ctx) => {
        return ctx.db
          .query("trainingParticipations")
          .withIndex("by_user", (q) => q.eq("userId", admin.userId))
          .collect()
      })
      const abandoned = sessions.filter((s) => s.status === "abandoned")
      expect(abandoned).toHaveLength(1)
    })

    it("filtre par domaine", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 5, "Cardiologie")
      await createQuestions(t, admin, 5, "Neurologie")

      const result = await admin.asAdmin.mutation(
        api.training.createTrainingSession,
        { questionCount: 5, domain: "Cardiologie" },
      )

      expect(result.questionIds).toHaveLength(5)
    })

    it("rejette si pas assez de questions disponibles", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 3) // Seulement 3

      await expect(
        admin.asAdmin.mutation(api.training.createTrainingSession, {
          questionCount: 5,
        }),
      ).rejects.toThrow("questions disponibles")
    })

    it("stocke domain=undefined quand 'all' est selectionne", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 10)

      const result = await admin.asAdmin.mutation(
        api.training.createTrainingSession,
        { questionCount: 5, domain: "all" },
      )

      const session = await t.run(async (ctx) => {
        return ctx.db.get(result.sessionId)
      })
      expect(session?.domain).toBeUndefined()
    })

    it("retourne des questionIds uniques (pas de doublons)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 15)

      const result = await admin.asAdmin.mutation(
        api.training.createTrainingSession,
        { questionCount: 10 },
      )

      const uniqueIds = new Set(result.questionIds)
      expect(uniqueIds.size).toBe(10)
    })
  })

  // ============================================
  // saveTrainingAnswer
  // ============================================
  describe("saveTrainingAnswer", () => {
    const setupSessionWithQuestions = async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      return { t, admin, userId, asUser, questionIds, sessionId }
    }

    it("sauvegarde une reponse correcte", async () => {
      const { asUser, sessionId } = await setupSessionWithQuestions()

      // Recuperer les vrais questionIds de la session
      const session = await asUser.query(api.training.getTrainingSessionById, {
        sessionId,
      })
      const questionId = session!.questions[0]._id

      const result = await asUser.mutation(api.training.saveTrainingAnswer, {
        sessionId,
        questionId,
        selectedAnswer: "A", // correctAnswer est "A"
      })

      expect(result.isCorrect).toBe(true)
      expect(result.answerId).toBeDefined()
    })

    it("sauvegarde une reponse incorrecte", async () => {
      const { asUser, sessionId } = await setupSessionWithQuestions()

      const session = await asUser.query(api.training.getTrainingSessionById, {
        sessionId,
      })
      const questionId = session!.questions[0]._id

      const result = await asUser.mutation(api.training.saveTrainingAnswer, {
        sessionId,
        questionId,
        selectedAnswer: "B",
      })

      expect(result.isCorrect).toBe(false)
    })

    it("met a jour une reponse existante", async () => {
      const { asUser, sessionId } = await setupSessionWithQuestions()

      const session = await asUser.query(api.training.getTrainingSessionById, {
        sessionId,
      })
      const questionId = session!.questions[0]._id

      const first = await asUser.mutation(api.training.saveTrainingAnswer, {
        sessionId,
        questionId,
        selectedAnswer: "B",
      })
      expect(first.isCorrect).toBe(false)

      const updated = await asUser.mutation(api.training.saveTrainingAnswer, {
        sessionId,
        questionId,
        selectedAnswer: "A",
      })
      expect(updated.isCorrect).toBe(true)
      expect(updated.answerId).toBe(first.answerId) // Meme ID
    })

    it("rejette si session pas possedee", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const { userId: otherUserId, asUser: otherUser } =
        await createRegularUser(t, "other")
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)
      await grantTrainingAccess(t, otherUserId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      const sessionData = await asUser.query(
        api.training.getTrainingSessionById,
        { sessionId },
      )

      await expect(
        otherUser.mutation(api.training.saveTrainingAnswer, {
          sessionId,
          questionId: sessionData!.questions[0]._id,
          selectedAnswer: "A",
        }),
      ).rejects.toThrow("appartient pas")
    })

    it("rejette si session pas in_progress", async () => {
      const { asUser, sessionId } = await setupSessionWithQuestions()

      // Completer la session
      await asUser.mutation(api.training.completeTrainingSession, { sessionId })

      const session = await asUser.query(api.training.getTrainingSessionById, {
        sessionId,
      })

      await expect(
        asUser.mutation(api.training.saveTrainingAnswer, {
          sessionId,
          questionId: session!.questions[0]._id,
          selectedAnswer: "A",
        }),
      ).rejects.toThrow("plus active")
    })

    it("rejette si question pas dans la session", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      // Creer une question hors session
      const extraIds = await createQuestions(t, admin, 1, "Extra")

      await expect(
        asUser.mutation(api.training.saveTrainingAnswer, {
          sessionId,
          questionId: extraIds[0],
          selectedAnswer: "A",
        }),
      ).rejects.toThrow("pas partie de la session")
    })

    it("re-verifie l'acces training", async () => {
      const { t, userId, asUser, sessionId } = await setupSessionWithQuestions()

      // Revoquer l'acces
      await t.run(async (ctx) => {
        const access = await ctx.db
          .query("userAccess")
          .withIndex("by_userId_accessType", (q) =>
            q.eq("userId", userId).eq("accessType", "training"),
          )
          .unique()
        if (access) {
          await ctx.db.patch(access._id, { expiresAt: Date.now() - 1000 })
        }
      })

      const session = await asUser.query(api.training.getTrainingSessionById, {
        sessionId,
      })

      await expect(
        asUser.mutation(api.training.saveTrainingAnswer, {
          sessionId,
          questionId: session!.questions[0]._id,
          selectedAnswer: "A",
        }),
      ).rejects.toThrow("expiré")
    })
  })

  // ============================================
  // completeTrainingSession
  // ============================================
  describe("completeTrainingSession", () => {
    it("calcule le score correctement", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      // Recuperer les questions de la session
      const sessionData = await asUser.query(
        api.training.getTrainingSessionById,
        { sessionId },
      )

      // Repondre a 3/5 correctement
      for (let i = 0; i < sessionData!.questions.length; i++) {
        await asUser.mutation(api.training.saveTrainingAnswer, {
          sessionId,
          questionId: sessionData!.questions[i]._id,
          selectedAnswer: i < 3 ? "A" : "B", // 3 correctes, 2 incorrectes
        })
      }

      const result = await asUser.mutation(
        api.training.completeTrainingSession,
        { sessionId },
      )

      expect(result.score).toBe(60) // 3/5 = 60%
      expect(result.correctCount).toBe(3)
      expect(result.totalQuestions).toBe(5)
      expect(result.completedAt).toBeDefined()
    })

    it("met status=completed et completedAt", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      await asUser.mutation(api.training.completeTrainingSession, { sessionId })

      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session?.status).toBe("completed")
      expect(session?.completedAt).toBeDefined()
    })

    it("rejette si pas proprietaire", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const { userId: otherUserId, asUser: otherUser } =
        await createRegularUser(t, "other")
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)
      await grantTrainingAccess(t, otherUserId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      await expect(
        otherUser.mutation(api.training.completeTrainingSession, { sessionId }),
      ).rejects.toThrow("appartient pas")
    })

    it("rejette si deja completee", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      await asUser.mutation(api.training.completeTrainingSession, { sessionId })

      await expect(
        asUser.mutation(api.training.completeTrainingSession, { sessionId }),
      ).rejects.toThrow("plus active")
    })

    it("score 0% sans reponses", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      const result = await asUser.mutation(
        api.training.completeTrainingSession,
        { sessionId },
      )
      expect(result.score).toBe(0)
      expect(result.correctCount).toBe(0)
    })
  })

  // ============================================
  // abandonTrainingSession
  // ============================================
  describe("abandonTrainingSession", () => {
    it("marque la session comme abandonnee", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      const result = await asUser.mutation(
        api.training.abandonTrainingSession,
        { sessionId },
      )
      expect(result.success).toBe(true)

      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session?.status).toBe("abandoned")
    })

    it("rejette si pas proprietaire", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const { asUser: otherUser } = await createRegularUser(t, "other")
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      await expect(
        otherUser.mutation(api.training.abandonTrainingSession, { sessionId }),
      ).rejects.toThrow("appartient pas")
    })

    it("rejette si pas in_progress", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )
      await asUser.mutation(api.training.completeTrainingSession, { sessionId })

      await expect(
        asUser.mutation(api.training.abandonTrainingSession, { sessionId }),
      ).rejects.toThrow("pas en cours")
    })
  })

  // ============================================
  // deleteTrainingSession
  // ============================================
  describe("deleteTrainingSession", () => {
    it("supprime une session completee et cascade les reponses", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      // Ajouter des reponses
      const sessionData = await asUser.query(
        api.training.getTrainingSessionById,
        { sessionId },
      )
      await asUser.mutation(api.training.saveTrainingAnswer, {
        sessionId,
        questionId: sessionData!.questions[0]._id,
        selectedAnswer: "A",
      })

      await asUser.mutation(api.training.completeTrainingSession, { sessionId })

      const result = await asUser.mutation(api.training.deleteTrainingSession, {
        sessionId,
      })
      expect(result.success).toBe(true)

      // Verifier suppression
      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session).toBeNull()
    })

    it("rejette la suppression d'une session in_progress", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      await expect(
        asUser.mutation(api.training.deleteTrainingSession, { sessionId }),
      ).rejects.toThrow("session en cours")
    })

    it("rejette si pas proprietaire", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const { asUser: otherUser } = await createRegularUser(t, "other")
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )
      await asUser.mutation(api.training.completeTrainingSession, { sessionId })

      await expect(
        otherUser.mutation(api.training.deleteTrainingSession, { sessionId }),
      ).rejects.toThrow("appartient pas")
    })
  })

  // ============================================
  // deleteAllTrainingSessions
  // ============================================
  describe("deleteAllTrainingSessions", () => {
    it("supprime les sessions completed/abandoned, garde in_progress", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 10)
      await grantTrainingAccess(t, userId)

      // Session 1: completed
      const s1 = await asUser.mutation(api.training.createTrainingSession, {
        questionCount: 5,
      })
      await asUser.mutation(api.training.completeTrainingSession, {
        sessionId: s1.sessionId,
      })

      // Session 2: abandoned
      const s2 = await asUser.mutation(api.training.createTrainingSession, {
        questionCount: 5,
      })
      await asUser.mutation(api.training.abandonTrainingSession, {
        sessionId: s2.sessionId,
      })

      // Session 3: in_progress
      const s3 = await asUser.mutation(api.training.createTrainingSession, {
        questionCount: 5,
      })

      const result = await asUser.mutation(
        api.training.deleteAllTrainingSessions,
        {},
      )

      expect(result.deletedCount).toBe(2) // completed + abandoned
      expect(result.success).toBe(true)

      // La session in_progress existe toujours
      const remaining = await t.run(async (ctx) => ctx.db.get(s3.sessionId))
      expect(remaining?.status).toBe("in_progress")
    })
  })

  // ============================================
  // getActiveTrainingSession
  // ============================================
  describe("getActiveTrainingSession", () => {
    it("retourne null si pas de session", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      const result = await asUser.query(
        api.training.getActiveTrainingSession,
        {},
      )
      expect(result).toBeNull()
    })

    it("retourne la session active avec canResume=true", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      await asUser.mutation(api.training.createTrainingSession, {
        questionCount: 5,
      })

      const result = await asUser.query(
        api.training.getActiveTrainingSession,
        {},
      )
      expect(result).not.toBeNull()
      expect(result!.canResume).toBe(true)
      expect(result!.isExpired).toBe(false)
      expect(result!.remainingTimeMs).toBeGreaterThan(0)
    })

    it("retourne session expiree avec isExpired=true", async () => {
      const t = convexTest(schema, modules)
      const { userId, asUser } = await createRegularUser(t)

      // Creer une session deja expiree
      await t.run(async (ctx) => {
        await ctx.db.insert("trainingParticipations", {
          userId,
          questionCount: 5,
          questionIds: [],
          score: 0,
          status: "in_progress",
          startedAt: Date.now() - 86400001,
          expiresAt: Date.now() - 1000,
        })
      })

      const result = await asUser.query(
        api.training.getActiveTrainingSession,
        {},
      )
      expect(result).not.toBeNull()
      expect(result!.isExpired).toBe(true)
      expect(result!.canResume).toBe(false)
      expect(result!.remainingTimeMs).toBe(0)
    })

    it("retourne null si non authentifie", async () => {
      const t = convexTest(schema, modules)
      const result = await t.query(api.training.getActiveTrainingSession, {})
      expect(result).toBeNull()
    })
  })

  // ============================================
  // getTrainingSessionById
  // ============================================
  describe("getTrainingSessionById", () => {
    it("masque correctAnswer/explanation pour session in_progress", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      const result = await asUser.query(api.training.getTrainingSessionById, {
        sessionId,
      })

      expect(result).not.toBeNull()
      // Session en cours : correctAnswer et explanation masquees
      for (const q of result!.questions) {
        expect("correctAnswer" in q).toBe(false)
        expect("explanation" in q).toBe(false)
      }
    })

    it("revele correctAnswer pour session completed (explanation lazy-loaded via getQuestionExplanations)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )
      await asUser.mutation(api.training.completeTrainingSession, { sessionId })

      const result = await asUser.query(api.training.getTrainingSessionById, {
        sessionId,
      })

      expect(result).not.toBeNull()
      // PR B : correctAnswer est révélé pour les sessions complétées.
      // explanation/references sont maintenant lazy-loadés via
      // exams.getQuestionExplanations (plus présents dans ce retour).
      for (const q of result!.questions) {
        expect("correctAnswer" in q).toBe(true)
        expect("explanation" in q).toBe(false)
        expect("references" in q).toBe(false)
      }
    })

    it("retourne null si session pas possedee (non-admin)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const { asUser: otherUser } = await createRegularUser(t, "other")
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      const result = await otherUser.query(
        api.training.getTrainingSessionById,
        { sessionId },
      )
      expect(result).toBeNull()
    })

    it("admin peut voir n'importe quelle session", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      const result = await admin.asAdmin.query(
        api.training.getTrainingSessionById,
        { sessionId },
      )
      expect(result).not.toBeNull()
    })
  })

  // ============================================
  // getTrainingHistory
  // ============================================
  describe("getTrainingHistory", () => {
    it("retourne les sessions completed paginees", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 10)
      await grantTrainingAccess(t, userId)

      // Creer et completer 2 sessions
      for (let i = 0; i < 2; i++) {
        const { sessionId } = await asUser.mutation(
          api.training.createTrainingSession,
          { questionCount: 5 },
        )
        await asUser.mutation(api.training.completeTrainingSession, {
          sessionId,
        })
      }

      const result = await asUser.query(api.training.getTrainingHistory, {
        paginationOpts: { numItems: 10, cursor: null },
      })

      expect(result.page).toHaveLength(2)
      expect(result.isDone).toBe(true)
    })

    it("retourne vide pour non authentifie", async () => {
      const t = convexTest(schema, modules)
      const result = await t.query(api.training.getTrainingHistory, {
        paginationOpts: { numItems: 10, cursor: null },
      })

      expect(result.page).toHaveLength(0)
      expect(result.isDone).toBe(true)
    })
  })

  // ============================================
  // getTrainingSessionResults
  // ============================================
  describe("getTrainingSessionResults", () => {
    it("retourne les resultats pour session completed", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )
      await asUser.mutation(api.training.completeTrainingSession, { sessionId })

      const result = await asUser.query(
        api.training.getTrainingSessionResults,
        { sessionId },
      )

      expect(result).not.toBeNull()
      expect("error" in result!).toBe(false)
      if (!("error" in result!)) {
        expect(result!.session.score).toBeDefined()
        expect(result!.questions).toHaveLength(5)
      }
    })

    it("retourne erreur pour session non completed", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      await createQuestions(t, admin, 5)
      await grantTrainingAccess(t, userId)

      const { sessionId } = await asUser.mutation(
        api.training.createTrainingSession,
        { questionCount: 5 },
      )

      const result = await asUser.query(
        api.training.getTrainingSessionResults,
        { sessionId },
      )

      expect(result).toEqual({ error: "SESSION_NOT_COMPLETED" })
    })
  })

  // ============================================
  // getTrainingStats
  // ============================================
  describe("getTrainingStats", () => {
    it("calcule averageScore correctement", async () => {
      const t = convexTest(schema, modules)
      const { userId, asUser } = await createRegularUser(t)

      // Creer des sessions completees avec scores
      await t.run(async (ctx) => {
        await ctx.db.insert("trainingParticipations", {
          userId,
          questionCount: 5,
          questionIds: [],
          score: 80,
          status: "completed",
          startedAt: Date.now() - 10000,
          completedAt: Date.now() - 5000,
          expiresAt: Date.now() + 80000,
        })
        await ctx.db.insert("trainingParticipations", {
          userId,
          questionCount: 5,
          questionIds: [],
          score: 60,
          status: "completed",
          startedAt: Date.now() - 20000,
          completedAt: Date.now() - 15000,
          expiresAt: Date.now() + 70000,
        })
      })

      const result = await asUser.query(api.training.getTrainingStats, {})
      expect(result).not.toBeNull()
      expect(result!.totalSessions).toBe(2)
      expect(result!.averageScore).toBe(70) // (80+60)/2
      expect(result!.totalQuestions).toBe(10) // 5+5
    })

    it("retourne null si non authentifie", async () => {
      const t = convexTest(schema, modules)
      const result = await t.query(api.training.getTrainingStats, {})
      expect(result).toBeNull()
    })
  })

  // ============================================
  // getAvailableDomains
  // ============================================
  describe("getAvailableDomains", () => {
    it("fallback: compte depuis la table questions", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      await createQuestions(t, admin, 3, "Cardiologie")
      await createQuestions(t, admin, 2, "Neurologie")

      const result = await t.query(api.training.getAvailableDomains, {})
      expect(result.totalQuestions).toBe(5)
      expect(result.domains).toHaveLength(2)
      expect(result.domains[0].domain).toBe("Cardiologie")
      expect(result.domains[0].count).toBe(3)
    })

    it("utilise questionStats quand disponible", async () => {
      const t = convexTest(schema, modules)

      await t.run(async (ctx) => {
        await ctx.db.insert("questionStats", {
          domain: "__total__",
          count: 100,
        })
        await ctx.db.insert("questionStats", {
          domain: "Cardiologie",
          count: 60,
        })
        await ctx.db.insert("questionStats", {
          domain: "Neurologie",
          count: 40,
        })
      })

      const result = await t.query(api.training.getAvailableDomains, {})
      expect(result.totalQuestions).toBe(100)
      expect(result.domains).toHaveLength(2)
    })
  })

  // ============================================
  // getMyTrainingScoreHistory
  // ============================================
  describe("getMyTrainingScoreHistory", () => {
    it("retourne les 10 dernieres sessions triees par completedAt", async () => {
      const t = convexTest(schema, modules)
      const { userId, asUser } = await createRegularUser(t)

      // Creer 12 sessions completees
      for (let i = 0; i < 12; i++) {
        await t.run(async (ctx) => {
          await ctx.db.insert("trainingParticipations", {
            userId,
            questionCount: 5,
            questionIds: [],
            score: 50 + i * 3,
            status: "completed",
            startedAt: Date.now() - (12 - i) * 10000,
            completedAt: Date.now() - (12 - i) * 5000,
            expiresAt: Date.now() + 86400000,
            domain: "Cardiologie",
          })
        })
      }

      const result = await asUser.query(
        api.training.getMyTrainingScoreHistory,
        {},
      )
      expect(result.sessions).toHaveLength(10)
      // Triees par completedAt ascendant
      for (let i = 1; i < result.sessions.length; i++) {
        expect(result.sessions[i].completedAt).toBeGreaterThanOrEqual(
          result.sessions[i - 1].completedAt,
        )
      }
    })

    it("calcule domainPerformance correctement", async () => {
      const t = convexTest(schema, modules)
      const { userId, asUser } = await createRegularUser(t)

      await t.run(async (ctx) => {
        await ctx.db.insert("trainingParticipations", {
          userId,
          questionCount: 5,
          questionIds: [],
          score: 80,
          status: "completed",
          startedAt: Date.now() - 10000,
          completedAt: Date.now() - 5000,
          expiresAt: Date.now() + 86400000,
          domain: "Cardiologie",
        })
        await ctx.db.insert("trainingParticipations", {
          userId,
          questionCount: 5,
          questionIds: [],
          score: 60,
          status: "completed",
          startedAt: Date.now() - 20000,
          completedAt: Date.now() - 15000,
          expiresAt: Date.now() + 86400000,
          domain: "Cardiologie",
        })
      })

      const result = await asUser.query(
        api.training.getMyTrainingScoreHistory,
        {},
      )
      expect(result.domainPerformance).toHaveLength(1)
      expect(result.domainPerformance[0].domain).toBe("Cardiologie")
      expect(result.domainPerformance[0].averageScore).toBe(70)
      expect(result.domainPerformance[0].sessionCount).toBe(2)
    })

    it("retourne vide si non authentifie", async () => {
      const t = convexTest(schema, modules)
      const result = await t.query(api.training.getMyTrainingScoreHistory, {})
      expect(result.sessions).toHaveLength(0)
      expect(result.domainPerformance).toHaveLength(0)
    })
  })

  // ============================================
  // closeExpiredTrainingSessions (cron)
  // ============================================
  describe("closeExpiredTrainingSessions", () => {
    it("ferme les sessions expirees et calcule le score", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const qIds = await createQuestions(t, admin, 5)

      // Creer une session expiree avec des reponses
      const sessionId = await t.run(async (ctx) => {
        const sid = await ctx.db.insert("trainingParticipations", {
          userId: admin.userId,
          questionCount: 5,
          questionIds: qIds,
          score: 0,
          status: "in_progress",
          startedAt: Date.now() - 86400001,
          expiresAt: Date.now() - 1000,
        })
        // 2 reponses correctes
        await ctx.db.insert("trainingAnswers", {
          participationId: sid,
          questionId: qIds[0],
          selectedAnswer: "A",
          isCorrect: true,
        })
        await ctx.db.insert("trainingAnswers", {
          participationId: sid,
          questionId: qIds[1],
          selectedAnswer: "A",
          isCorrect: true,
        })
        return sid
      })

      const result = await t.mutation(
        internal.training.closeExpiredTrainingSessions,
        {},
      )

      expect(result.closedCount).toBe(1)

      const session = await t.run(async (ctx) => ctx.db.get(sessionId))
      expect(session?.status).toBe("abandoned")
      expect(session?.score).toBe(40) // 2/5 = 40%
    })

    it("retourne closedCount=0 si aucune session expiree", async () => {
      const t = convexTest(schema, modules)

      const result = await t.mutation(
        internal.training.closeExpiredTrainingSessions,
        {},
      )
      expect(result.closedCount).toBe(0)
    })
  })
})
