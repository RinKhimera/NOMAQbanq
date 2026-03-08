import { v } from "convex/values"
import { internal } from "./_generated/api"
import { httpAction, internalMutation } from "./_generated/server"

/**
 * Reset exam state for E2E tests.
 * - Ensures at least one active exam exists (creates one if needed)
 * - Deletes the user's participation for the active exam
 * - Deletes in-progress training sessions
 * Only callable via internal mutation (from HTTP action).
 */
export const resetExamParticipation = internalMutation({
  args: { userEmail: v.string() },
  handler: async (ctx, { userEmail }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()

    if (!user) {
      console.log(`[E2E Reset] User not found: ${userEmail}`)
      return {
        deletedParticipations: 0,
        deletedAnswers: 0,
        deletedTrainingSessions: 0,
        activatedExam: null as string | null,
      }
    }

    const now = Date.now()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

    // Find all exams (active or not)
    const allExams = await ctx.db.query("exams").take(100)

    // Find an active exam (startDate < now < endDate)
    let activeExam = allExams.find(
      (e) => e.isActive && e.startDate <= now && e.endDate > now,
    )
    let activatedExamTitle: string | null = null

    if (!activeExam) {
      // Try to reactivate an existing exam
      const existingExam = allExams.find((e) => e.isActive)
      if (existingExam) {
        await ctx.db.patch(existingExam._id, {
          startDate: now - 60_000,
          endDate: now + thirtyDaysMs,
        })
        activeExam = existingExam
        activatedExamTitle = existingExam.title
        console.log(`[E2E Reset] Reactivated exam: ${existingExam.title}`)
      } else {
        // No exams at all — create one from existing questions
        const questions = await ctx.db.query("questions").take(10)
        if (questions.length >= 5) {
          const examId = await ctx.db.insert("exams", {
            title: "Examen E2E",
            description: "Examen automatique pour tests E2E",
            startDate: now - 60_000,
            endDate: now + thirtyDaysMs,
            questionIds: questions.slice(0, 10).map((q) => q._id),
            completionTime: 10 * 60, // 10 minutes
            isActive: true,
            createdBy: user._id,
          })
          activeExam = (await ctx.db.get(examId)) ?? undefined
          activatedExamTitle = "Examen E2E (created)"
          console.log(
            `[E2E Reset] Created exam with ${questions.length} questions`,
          )
        } else {
          console.log(
            `[E2E Reset] Not enough questions to create exam (${questions.length})`,
          )
        }
      }
    }

    // Delete participation for the active exam only (keep past results)
    let deletedParticipations = 0
    let deletedAnswers = 0
    if (activeExam) {
      const participations = await ctx.db
        .query("examParticipations")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect()

      for (const participation of participations) {
        if (participation.examId !== activeExam._id) continue

        const answers = await ctx.db
          .query("examAnswers")
          .withIndex("by_participation", (q) =>
            q.eq("participationId", participation._id),
          )
          .collect()

        for (const answer of answers) {
          await ctx.db.delete(answer._id)
          deletedAnswers++
        }

        await ctx.db.delete(participation._id)
        deletedParticipations++
      }
    }

    // Delete in-progress training participations
    const trainingParticipations = await ctx.db
      .query("trainingParticipations")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "in_progress"),
      )
      .collect()

    for (const session of trainingParticipations) {
      await ctx.db.delete(session._id)
    }

    console.log(
      `[E2E Reset] Deleted ${deletedParticipations} participations, ${deletedAnswers} answers, ${trainingParticipations.length} training sessions for ${userEmail}`,
    )

    return {
      deletedParticipations,
      deletedAnswers,
      deletedTrainingSessions: trainingParticipations.length,
      activatedExam: activatedExamTitle,
    }
  },
})

/**
 * Cleanup E2E test data (questions, exams with [E2E] prefix).
 * Called from global.teardown.ts after all tests complete.
 */
export const cleanupE2EData = internalMutation({
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    let deletedQuestions = 0
    let deletedExams = 0

    // Delete questions with [E2E] prefix
    const questions = await ctx.db.query("questions").take(500)
    for (const q of questions) {
      if (q.question.startsWith(prefix)) {
        await ctx.db.delete(q._id)
        deletedQuestions++
      }
    }

    // Delete exams with [E2E] prefix
    const exams = await ctx.db.query("exams").take(500)
    for (const exam of exams) {
      if (exam.title.startsWith(prefix)) {
        // Delete related participations and answers
        const participations = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam", (q) => q.eq("examId", exam._id))
          .collect()

        for (const p of participations) {
          const answers = await ctx.db
            .query("examAnswers")
            .withIndex("by_participation", (q) =>
              q.eq("participationId", p._id),
            )
            .collect()
          for (const a of answers) {
            await ctx.db.delete(a._id)
          }
          await ctx.db.delete(p._id)
        }

        await ctx.db.delete(exam._id)
        deletedExams++
      }
    }

    console.log(
      `[E2E Cleanup] Deleted ${deletedQuestions} questions, ${deletedExams} exams with prefix "${prefix}"`,
    )

    return { deletedQuestions, deletedExams }
  },
})

/**
 * HTTP action handler for E2E cleanup endpoint.
 * Protected by E2E_RESET_SECRET environment variable.
 */
export const cleanupHandler = httpAction(async (ctx, request) => {
  const resetSecret = process.env.E2E_RESET_SECRET
  if (!resetSecret) {
    return new Response(JSON.stringify({ error: "E2E reset not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  }

  const body = await request.json()
  const { secret, prefix } = body as {
    secret?: string
    prefix?: string
  }

  if (secret !== resetSecret) {
    return new Response(JSON.stringify({ error: "Invalid secret" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!prefix) {
    return new Response(JSON.stringify({ error: "prefix is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const result = await ctx.runMutation(internal.testing.cleanupE2EData, {
      prefix,
    })

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[E2E Cleanup] Error:", error)
    return new Response(
      JSON.stringify({
        error: "Cleanup failed",
        message: String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})

/**
 * HTTP action handler for E2E reset endpoint.
 * Protected by E2E_RESET_SECRET environment variable.
 */
export const resetExamHandler = httpAction(async (ctx, request) => {
  const resetSecret = process.env.E2E_RESET_SECRET
  if (!resetSecret) {
    return new Response(JSON.stringify({ error: "E2E reset not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  }

  const body = await request.json()
  const { secret, userEmail } = body as {
    secret?: string
    userEmail?: string
  }

  if (secret !== resetSecret) {
    return new Response(JSON.stringify({ error: "Invalid secret" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!userEmail) {
    return new Response(JSON.stringify({ error: "userEmail is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const result = await ctx.runMutation(
      internal.testing.resetExamParticipation,
      { userEmail },
    )

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[E2E Reset] Error:", error)
    return new Response(
      JSON.stringify({
        error: "Reset failed",
        message: String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
