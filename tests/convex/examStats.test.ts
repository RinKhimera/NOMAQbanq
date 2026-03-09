import { convexTest } from "convex-test"
import { beforeEach, describe, expect, it } from "vitest"
import { api } from "../../convex/_generated/api"
import schema from "../../convex/schema"
import {
  clearProductCache,
  createAdminUser,
  createQuestions,
  createRegularUser,
  grantAccess,
} from "../helpers/convex-helpers"

const modules = import.meta.glob("../../convex/**/*.ts")

describe("examStats", () => {
  beforeEach(() => {
    clearProductCache()
  })

  // ============================================
  // getExamsStats [admin]
  // ============================================
  describe("getExamsStats", () => {
    it("rejette les non-admin", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.query(api.examStats.getExamsStats, {}),
      ).rejects.toThrow("non autorisé")
    })

    it("retourne les comptages corrects", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionIds = await createQuestions(t, admin, 5)

      const now = Date.now()

      // Examen actif
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Actif",
        startDate: now - 1000,
        endDate: now + 86400000,
        questionIds,
      })

      // Examen futur
      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Futur",
        startDate: now + 86400000,
        endDate: now + 2 * 86400000,
        questionIds,
      })

      // Examen passe
      await t.run(async (ctx) => {
        await ctx.db.insert("exams", {
          title: "Passe",
          startDate: now - 2 * 86400000,
          endDate: now - 86400000,
          questionIds,
          completionTime: 100,
          isActive: true,
          createdBy: admin.userId,
        })
      })

      const result = await admin.asAdmin.query(api.examStats.getExamsStats, {})

      expect(result.total).toBe(3)
      expect(result.active).toBe(1)
      expect(result.upcoming).toBe(1)
      expect(result.past).toBe(1)
    })

    it("compte les candidats eligibles avec acces exam", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId } = await createRegularUser(t)
      await grantAccess(t, userId, "exam")

      const result = await admin.asAdmin.query(api.examStats.getExamsStats, {})
      expect(result.eligibleCandidates).toBeGreaterThanOrEqual(1)
    })
  })

  // ============================================
  // getExamLeaderboard
  // ============================================
  describe("getExamLeaderboard", () => {
    const setupExamWithParticipation = async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionIds = await createQuestions(t, admin, 5)

      const now = Date.now()

      // Creer un examen termine
      const examId = await t.run(async (ctx) => {
        return ctx.db.insert("exams", {
          title: "Examen termine",
          startDate: now - 2 * 86400000,
          endDate: now - 86400000, // Termine hier
          questionIds,
          completionTime: 100,
          isActive: true,
          createdBy: admin.userId,
        })
      })

      const { userId, asUser } = await createRegularUser(t)
      await grantAccess(t, userId, "exam")

      // Creer une participation completee
      await t.run(async (ctx) => {
        await ctx.db.insert("examParticipations", {
          examId,
          userId,
          score: 80,
          status: "completed",
          completedAt: now - 86400000,
          startedAt: now - 2 * 86400000,
        })
      })

      return { t, admin, examId, userId, asUser }
    }

    it("admin voit le leaderboard pendant l'examen", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionIds = await createQuestions(t, admin, 5)

      // Examen en cours
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "En cours",
        startDate: Date.now() - 1000,
        endDate: Date.now() + 86400000,
        questionIds,
      })

      const result = await admin.asAdmin.query(
        api.examStats.getExamLeaderboard,
        { examId },
      )
      // Admin peut voir le leaderboard (vide car aucune participation)
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it("non-admin recoit tableau vide pendant l'examen", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 5)

      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "En cours",
        startDate: Date.now() - 1000,
        endDate: Date.now() + 86400000,
        questionIds,
      })

      const result = await asUser.query(api.examStats.getExamLeaderboard, {
        examId,
      })
      expect(result).toHaveLength(0)
    })

    it("participant voit le leaderboard apres la fin de l'examen", async () => {
      const { asUser, examId } = await setupExamWithParticipation()

      const result = await asUser.query(api.examStats.getExamLeaderboard, {
        examId,
      })
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].score).toBe(80)
    })

    it("non-participant sans acces recoit tableau vide apres la fin", async () => {
      const { t, examId } = await setupExamWithParticipation()
      const { asUser: outsider } = await createRegularUser(t, "outsider")

      const result = await outsider.query(api.examStats.getExamLeaderboard, {
        examId,
      })
      expect(result).toHaveLength(0)
    })

    it("non authentifie recoit tableau vide", async () => {
      const { t, examId } = await setupExamWithParticipation()

      const result = await t.query(api.examStats.getExamLeaderboard, {
        examId,
      })
      expect(result).toHaveLength(0)
    })

    it("trie par score descendant", async () => {
      const { t, admin, examId } = await setupExamWithParticipation()

      // Ajouter un 2e participant avec score plus haut
      const { userId: user2Id } = await createRegularUser(t, "top")
      await t.run(async (ctx) => {
        await ctx.db.insert("examParticipations", {
          examId,
          userId: user2Id,
          score: 95,
          status: "completed",
          completedAt: Date.now(),
          startedAt: Date.now() - 1000,
        })
      })

      const result = await admin.asAdmin.query(
        api.examStats.getExamLeaderboard,
        { examId },
      )
      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score)
    })

    it("inclut seulement les participations completed/auto_submitted", async () => {
      const { t, admin, examId } = await setupExamWithParticipation()

      // Ajouter une participation in_progress
      const { userId: user2Id } = await createRegularUser(t, "inprogress")
      await t.run(async (ctx) => {
        await ctx.db.insert("examParticipations", {
          examId,
          userId: user2Id,
          score: 0,
          completedAt: 0, // Required par le schema, 0 = pas vraiment complete
          status: "in_progress",
          startedAt: Date.now(),
        })
      })

      const result = await admin.asAdmin.query(
        api.examStats.getExamLeaderboard,
        { examId },
      )
      // Seulement les participations completed (pas in_progress)
      expect(result).toHaveLength(1)
      expect(result[0].score).toBe(80)
    })
  })

  // ============================================
  // getMyDashboardStats
  // ============================================
  describe("getMyDashboardStats", () => {
    it("retourne null si non authentifie", async () => {
      const t = convexTest(schema, modules)
      const result = await t.query(api.examStats.getMyDashboardStats, {})
      expect(result).toBeNull()
    })

    it("retourne 0 examens disponibles sans acces exam", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      const result = await asUser.query(api.examStats.getMyDashboardStats, {})
      expect(result).not.toBeNull()
      expect(result!.availableExamsCount).toBe(0)
    })

    it("calcule averageScore correctement", async () => {
      const t = convexTest(schema, modules)
      const { userId, asUser } = await createRegularUser(t)
      await grantAccess(t, userId, "exam")

      await t.run(async (ctx) => {
        // 2 participations completees
        await ctx.db.insert("examParticipations", {
          examId:
            (await ctx.db.query("exams").first())?._id ??
            (await ctx.db.insert("exams", {
              title: "Exam",
              startDate: Date.now() - 86400000,
              endDate: Date.now() + 86400000,
              questionIds: [],
              completionTime: 100,
              isActive: true,
              createdBy: userId,
            })),
          userId,
          score: 80,
          status: "completed",
          completedAt: Date.now(),
          startedAt: Date.now() - 1000,
        })
      })

      const result = await asUser.query(api.examStats.getMyDashboardStats, {})
      expect(result).not.toBeNull()
      expect(result!.completedExamsCount).toBe(1)
      expect(result!.averageScore).toBe(80)
    })
  })

  // ============================================
  // getMyRecentExams
  // ============================================
  describe("getMyRecentExams", () => {
    it("retourne vide si non authentifie", async () => {
      const t = convexTest(schema, modules)
      const result = await t.query(api.examStats.getMyRecentExams, {})
      expect(result).toHaveLength(0)
    })

    it("retourne max 5 examens", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 5)
      await grantAccess(t, userId, "exam")

      // Creer 7 examens actifs
      for (let i = 0; i < 7; i++) {
        await admin.asAdmin.mutation(api.exams.createExam, {
          title: `Exam ${i}`,
          startDate: Date.now() - 1000,
          endDate: Date.now() + 86400000,
          questionIds,
        })
      }

      const result = await asUser.query(api.examStats.getMyRecentExams, {})
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBeLessThanOrEqual(5)
    })
  })

  // ============================================
  // getAllExamsWithUserParticipation
  // ============================================
  describe("getAllExamsWithUserParticipation", () => {
    it("inclut userHasTaken=false pour non authentifie", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionIds = await createQuestions(t, admin, 5)

      await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Exam",
        startDate: Date.now() - 1000,
        endDate: Date.now() + 86400000,
        questionIds,
      })

      const result = await t.query(
        api.examStats.getAllExamsWithUserParticipation,
        {},
      )
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].userHasTaken).toBe(false)
      expect(result[0].userParticipation).toBeNull()
    })

    it("inclut userHasTaken=true quand l'utilisateur a complete", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 5)

      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Exam",
        startDate: Date.now() - 1000,
        endDate: Date.now() + 86400000,
        questionIds,
      })

      await t.run(async (ctx) => {
        await ctx.db.insert("examParticipations", {
          examId,
          userId,
          score: 75,
          status: "completed",
          completedAt: Date.now(),
          startedAt: Date.now() - 1000,
        })
      })

      const result = await asUser.query(
        api.examStats.getAllExamsWithUserParticipation,
        {},
      )
      const exam = result.find((e) => e._id === examId)
      expect(exam?.userHasTaken).toBe(true)
      expect(exam?.userParticipation?.score).toBe(75)
    })
  })

  // ============================================
  // getMyScoreHistory
  // ============================================
  describe("getMyScoreHistory", () => {
    it("retourne vide si non authentifie", async () => {
      const t = convexTest(schema, modules)
      const result = await t.query(api.examStats.getMyScoreHistory, {})
      expect(result).toHaveLength(0)
    })

    it("retourne les 10 derniers examens completes avec scores", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 5)

      // Creer un examen
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Exam Score",
        startDate: Date.now() - 86400000,
        endDate: Date.now() + 86400000,
        questionIds,
      })

      // Creer 12 participations completees
      for (let i = 0; i < 12; i++) {
        await t.run(async (ctx) => {
          await ctx.db.insert("examParticipations", {
            examId,
            userId,
            score: 50 + i * 3,
            status: "completed",
            completedAt: Date.now() - (12 - i) * 1000,
            startedAt: Date.now() - (12 - i) * 2000,
          })
        })
      }

      const result = await asUser.query(api.examStats.getMyScoreHistory, {})
      expect(result.length).toBeLessThanOrEqual(10)
    })

    it("trie par completedAt ascendant pour le graphique", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 5)

      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Exam",
        startDate: Date.now() - 86400000,
        endDate: Date.now() + 86400000,
        questionIds,
      })

      for (let i = 0; i < 3; i++) {
        await t.run(async (ctx) => {
          await ctx.db.insert("examParticipations", {
            examId,
            userId,
            score: 60 + i * 10,
            status: "completed",
            completedAt: Date.now() - (3 - i) * 10000,
            startedAt: Date.now() - (3 - i) * 20000,
          })
        })
      }

      const result = await asUser.query(api.examStats.getMyScoreHistory, {})
      for (let i = 1; i < result.length; i++) {
        expect(result[i].completedAt).toBeGreaterThanOrEqual(
          result[i - 1].completedAt,
        )
      }
    })
  })
})
