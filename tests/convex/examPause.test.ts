import { convexTest } from "convex-test"
import { beforeEach, describe, expect, it } from "vitest"
import { api } from "../../convex/_generated/api"
import { validatePauseTransition } from "../../convex/examPause"
import schema from "../../convex/schema"
import {
  clearProductCache,
  createAdminUser,
  createExamWithPause,
  createQuestions,
  createRegularUser,
  grantAccess,
} from "../helpers/convex-helpers"

const modules = import.meta.glob("../../convex/**/*.ts")

describe("examPause", () => {
  beforeEach(() => {
    clearProductCache()
  })

  // ============================================
  // validatePauseTransition (pure function)
  // ============================================
  describe("validatePauseTransition", () => {
    it("autorise before_pause -> during_pause", () => {
      expect(() =>
        validatePauseTransition("before_pause", "during_pause"),
      ).not.toThrow()
    })

    it("autorise during_pause -> after_pause", () => {
      expect(() =>
        validatePauseTransition("during_pause", "after_pause"),
      ).not.toThrow()
    })

    it("rejette undefined -> during_pause", () => {
      expect(() => validatePauseTransition(undefined, "during_pause")).toThrow()
    })

    it("rejette before_pause -> after_pause (skip)", () => {
      expect(() =>
        validatePauseTransition("before_pause", "after_pause"),
      ).toThrow()
    })

    it("rejette after_pause -> during_pause (etat terminal)", () => {
      expect(() =>
        validatePauseTransition("after_pause", "during_pause"),
      ).toThrow()
    })

    it("rejette after_pause -> after_pause", () => {
      expect(() =>
        validatePauseTransition("after_pause", "after_pause"),
      ).toThrow()
    })

    it("rejette during_pause -> during_pause", () => {
      expect(() =>
        validatePauseTransition("during_pause", "during_pause"),
      ).toThrow()
    })
  })

  // ============================================
  // startPause
  // ============================================
  describe("startPause", () => {
    const setupExamWithPause = async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      await grantAccess(t, userId, "exam")

      const examId = await createExamWithPause(t, admin, questionIds)

      // Demarrer l'examen pour creer une participation
      await asUser.mutation(api.exams.startExam, { examId })

      // Mettre la participation en before_pause et ajouter startedAt
      await t.run(async (ctx) => {
        const participation = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam_user", (q) =>
            q.eq("examId", examId).eq("userId", userId),
          )
          .unique()
        if (participation) {
          await ctx.db.patch(participation._id, {
            pausePhase: "before_pause",
            startedAt: Date.now() - 60 * 60 * 1000, // Demarree il y a 1h (bien passe la mi-parcours)
          })
        }
      })

      return { t, admin, userId, asUser, examId, questionIds }
    }

    it("demarre la pause avec succes", async () => {
      const { asUser, examId } = await setupExamWithPause()

      const result = await asUser.mutation(api.examPause.startPause, {
        examId,
      })

      expect(result.pauseStartedAt).toBeDefined()
      expect(result.pauseDurationMinutes).toBe(15)
    })

    it("rejette si examen n'existe pas", async () => {
      const t = convexTest(schema, modules)
      const { asUser } = await createRegularUser(t)

      await expect(
        asUser.mutation(api.examPause.startPause, {
          // @ts-expect-error testing with invalid ID
          examId: "k57d1r8aet6a5ep2wg3hpw6kss7g6x30",
        }),
      ).rejects.toThrow()
    })

    it("rejette si pause pas activee sur l'examen", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 5)
      await grantAccess(t, userId, "exam")

      // Creer examen SANS pause
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Examen sans pause",
        startDate: Date.now() - 1000,
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds,
      })

      await asUser.mutation(api.exams.startExam, { examId })

      await expect(
        asUser.mutation(api.examPause.startPause, { examId }),
      ).rejects.toThrow("pas activée")
    })

    it("rejette si participation pas in_progress", async () => {
      const { t, asUser, userId, examId } = await setupExamWithPause()

      // Marquer la participation comme completed
      await t.run(async (ctx) => {
        const p = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam_user", (q) =>
            q.eq("examId", examId).eq("userId", userId),
          )
          .unique()
        if (p) {
          await ctx.db.patch(p._id, { status: "completed" })
        }
      })

      await expect(
        asUser.mutation(api.examPause.startPause, { examId }),
      ).rejects.toThrow("pas en cours")
    })

    it("rejette transition invalide (during_pause -> during_pause)", async () => {
      const { t, asUser, userId, examId } = await setupExamWithPause()

      // Deja en during_pause
      await t.run(async (ctx) => {
        const p = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam_user", (q) =>
            q.eq("examId", examId).eq("userId", userId),
          )
          .unique()
        if (p) {
          await ctx.db.patch(p._id, {
            pausePhase: "during_pause",
            pauseStartedAt: Date.now(),
          })
        }
      })

      await expect(
        asUser.mutation(api.examPause.startPause, { examId }),
      ).rejects.toThrow()
    })

    it("rejette auto trigger avant mi-parcours", async () => {
      const { t, asUser, userId, examId } = await setupExamWithPause()

      // Mettre startedAt tres recent (pas encore a la mi-parcours)
      await t.run(async (ctx) => {
        const p = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam_user", (q) =>
            q.eq("examId", examId).eq("userId", userId),
          )
          .unique()
        if (p) {
          await ctx.db.patch(p._id, {
            startedAt: Date.now() - 1000, // Juste demarree
          })
        }
      })

      await expect(
        asUser.mutation(api.examPause.startPause, {
          examId,
          manualTrigger: false,
        }),
      ).rejects.toThrow("mi-parcours")
    })

    it("manual trigger bypass la verification de mi-parcours", async () => {
      const { t, asUser, userId, examId } = await setupExamWithPause()

      // Mettre startedAt tres recent
      await t.run(async (ctx) => {
        const p = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam_user", (q) =>
            q.eq("examId", examId).eq("userId", userId),
          )
          .unique()
        if (p) {
          await ctx.db.patch(p._id, {
            startedAt: Date.now() - 1000,
          })
        }
      })

      const result = await asUser.mutation(api.examPause.startPause, {
        examId,
        manualTrigger: true,
      })
      expect(result.pauseStartedAt).toBeDefined()
    })
  })

  // ============================================
  // resumeFromPause
  // ============================================
  describe("resumeFromPause", () => {
    it("reprend avec succes (during_pause -> after_pause)", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      await grantAccess(t, userId, "exam")

      const examId = await createExamWithPause(t, admin, questionIds)
      await asUser.mutation(api.exams.startExam, { examId })

      // Mettre en during_pause
      await t.run(async (ctx) => {
        const p = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam_user", (q) =>
            q.eq("examId", examId).eq("userId", userId),
          )
          .unique()
        if (p) {
          await ctx.db.patch(p._id, {
            pausePhase: "during_pause",
            pauseStartedAt: Date.now() - 5 * 60 * 1000, // 5 min de pause
          })
        }
      })

      const result = await asUser.mutation(api.examPause.resumeFromPause, {
        examId,
      })

      expect(result.pauseEndedAt).toBeDefined()
      expect(result.isPauseCutShort).toBe(true) // 5min < 15min
      expect(result.totalPauseDurationMs).toBeGreaterThan(0)
    })

    it("isPauseCutShort=false quand pause complete", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      await grantAccess(t, userId, "exam")

      const examId = await createExamWithPause(t, admin, questionIds)
      await asUser.mutation(api.exams.startExam, { examId })

      // Mettre en during_pause avec duree depassee
      await t.run(async (ctx) => {
        const p = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam_user", (q) =>
            q.eq("examId", examId).eq("userId", userId),
          )
          .unique()
        if (p) {
          await ctx.db.patch(p._id, {
            pausePhase: "during_pause",
            pauseStartedAt: Date.now() - 20 * 60 * 1000, // 20 min > 15 min
          })
        }
      })

      const result = await asUser.mutation(api.examPause.resumeFromPause, {
        examId,
      })
      expect(result.isPauseCutShort).toBe(false)
    })

    it("rejette transition invalide", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      await grantAccess(t, userId, "exam")

      const examId = await createExamWithPause(t, admin, questionIds)
      await asUser.mutation(api.exams.startExam, { examId })

      // Encore en before_pause (pas during_pause)
      await t.run(async (ctx) => {
        const p = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam_user", (q) =>
            q.eq("examId", examId).eq("userId", userId),
          )
          .unique()
        if (p) {
          await ctx.db.patch(p._id, { pausePhase: "before_pause" })
        }
      })

      await expect(
        asUser.mutation(api.examPause.resumeFromPause, { examId }),
      ).rejects.toThrow()
    })
  })

  // ============================================
  // getPauseStatus
  // ============================================
  describe("getPauseStatus", () => {
    it("retourne null si non authentifie", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      const examId = await createExamWithPause(t, admin, questionIds)

      const result = await t.query(api.examPause.getPauseStatus, { examId })
      expect(result).toBeNull()
    })

    it("retourne null si pas de participation", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      const examId = await createExamWithPause(t, admin, questionIds)

      const result = await asUser.query(api.examPause.getPauseStatus, {
        examId,
      })
      expect(result).toBeNull()
    })

    it("retourne les infos de pause correctes", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      await grantAccess(t, userId, "exam")
      const examId = await createExamWithPause(t, admin, questionIds)
      await asUser.mutation(api.exams.startExam, { examId })

      const result = await asUser.query(api.examPause.getPauseStatus, {
        examId,
      })

      expect(result).not.toBeNull()
      expect(result!.enablePause).toBe(true)
      expect(result!.pauseDurationMinutes).toBe(15)
      expect(result!.totalQuestions).toBe(10)
      expect(result!.midpoint).toBe(5)
      expect(result!.questionsBeforePause).toBe(5)
      expect(result!.questionsAfterPause).toBe(5)
    })
  })

  // ============================================
  // validateQuestionAccess
  // ============================================
  describe("validateQuestionAccess", () => {
    const setupParticipation = async (
      pausePhase?: "before_pause" | "during_pause" | "after_pause",
    ) => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      await grantAccess(t, userId, "exam")
      const examId = await createExamWithPause(t, admin, questionIds)
      await asUser.mutation(api.exams.startExam, { examId })

      if (pausePhase) {
        await t.run(async (ctx) => {
          const p = await ctx.db
            .query("examParticipations")
            .withIndex("by_exam_user", (q) =>
              q.eq("examId", examId).eq("userId", userId),
            )
            .unique()
          if (p) {
            await ctx.db.patch(p._id, { pausePhase })
          }
        })
      }

      return { t, asUser, examId }
    }

    it("autorise toutes les questions quand pause non activee", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const { userId, asUser } = await createRegularUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      await grantAccess(t, userId, "exam")

      // Examen SANS pause
      const examId = await admin.asAdmin.mutation(api.exams.createExam, {
        title: "Sans pause",
        startDate: Date.now() - 1000,
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        questionIds,
      })
      await asUser.mutation(api.exams.startExam, { examId })

      const result = await asUser.query(api.examPause.validateQuestionAccess, {
        examId,
        questionIndex: 9,
      })
      expect(result.allowed).toBe(true)
    })

    it("before_pause: bloque la 2e moitie", async () => {
      const { asUser, examId } = await setupParticipation("before_pause")

      // Question index 5 (midpoint pour 10 questions) = bloquee
      const result = await asUser.query(api.examPause.validateQuestionAccess, {
        examId,
        questionIndex: 5,
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain("déverrouillée après la pause")
    })

    it("before_pause: autorise la 1ere moitie", async () => {
      const { asUser, examId } = await setupParticipation("before_pause")

      const result = await asUser.query(api.examPause.validateQuestionAccess, {
        examId,
        questionIndex: 4, // < midpoint (5)
      })
      expect(result.allowed).toBe(true)
    })

    it("during_pause: bloque toutes les questions", async () => {
      const { asUser, examId } = await setupParticipation("during_pause")

      const result = await asUser.query(api.examPause.validateQuestionAccess, {
        examId,
        questionIndex: 0,
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain("pendant la pause")
    })

    it("after_pause: autorise toutes les questions", async () => {
      const { asUser, examId } = await setupParticipation("after_pause")

      const result = await asUser.query(api.examPause.validateQuestionAccess, {
        examId,
        questionIndex: 9,
      })
      expect(result.allowed).toBe(true)
    })

    it("non authentifie: bloque", async () => {
      const t = convexTest(schema, modules)
      const admin = await createAdminUser(t)
      const questionIds = await createQuestions(t, admin, 10)
      const examId = await createExamWithPause(t, admin, questionIds)

      const result = await t.query(api.examPause.validateQuestionAccess, {
        examId,
        questionIndex: 0,
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain("Non authentifié")
    })
  })
})
