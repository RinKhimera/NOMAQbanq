import { v } from "convex/values"

import { internalMutation, internalQuery, action } from "./_generated/server"
import { internal } from "./_generated/api"

// ============================================
// MIGRATION: V1 (embedded participants) → V2 (normalized tables)
// ============================================
//
// PRODUCTION MIGRATION STRATEGY:
// ==============================
//
// BEFORE MIGRATION:
// 1. Take a backup in Convex Dashboard (Settings > Backups > Backup Now)
//    Or via CLI: npx convex export --prod --path ./backups
//
// 2. Deploy the new schema (with V2 tables) WITHOUT changing frontend code
//    The V1 and V2 functions coexist safely
//
// 3. Test migration in dev first:
//    - Run: npx convex run migrations:checkMigrationStatus
//    - Run: npx convex run migrations:migrateExamParticipants --args '{"batchSize": 1}'
//
// MIGRATION STEPS (PRODUCTION):
// 1. Run migration in small batches (avoid timeout):
//    npx convex run --prod migrations:migrateExamParticipants --args '{"batchSize": 5}'
//
// 2. Repeat until checkMigrationStatus shows migrationComplete: true
//
// 3. Verify data integrity:
//    npx convex run --prod migrations:verifyMigrationIntegrity
//
// 4. Deploy frontend with V2 API calls
//
// 5. After verification period (1-2 weeks), run cleanup:
//    npx convex run --prod migrations:migrateExamParticipants --args '{"clearAfterMigration": true}'
//
// ROLLBACK (if needed):
// 1. Restore from backup taken in step 1
//    npx convex import --prod --replace backup.zip
// 2. Redeploy old frontend code
//
// ============================================

/**
 * Query to get exams that have participants to migrate
 * Returns exams with embedded participants that haven't been migrated yet
 */
export const getExamsToMigrate = internalQuery({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { batchSize = 10 }) => {
    const exams = await ctx.db.query("exams").collect()

    // Filter exams that have participants in the embedded array
    const examsWithParticipants = exams.filter(
      (exam) => exam.participants && exam.participants.length > 0
    )

    return examsWithParticipants.slice(0, batchSize)
  },
})

/**
 * Check if a participation already exists in V2 tables
 */
export const checkExistingParticipation = internalQuery({
  args: {
    examId: v.id("exams"),
    userId: v.id("users"),
  },
  handler: async (ctx, { examId, userId }) => {
    return await ctx.db
      .query("examParticipations")
      .withIndex("by_exam_user", (q) => q.eq("examId", examId).eq("userId", userId))
      .unique()
  },
})

/**
 * Migrate a single participant from embedded array to V2 tables
 */
export const migrateParticipant = internalMutation({
  args: {
    examId: v.id("exams"),
    participant: v.object({
      userId: v.id("users"),
      score: v.number(),
      completedAt: v.number(),
      startedAt: v.optional(v.number()),
      status: v.optional(
        v.union(
          v.literal("in_progress"),
          v.literal("completed"),
          v.literal("auto_submitted")
        )
      ),
      pausePhase: v.optional(
        v.union(
          v.literal("before_pause"),
          v.literal("during_pause"),
          v.literal("after_pause")
        )
      ),
      pauseStartedAt: v.optional(v.number()),
      pauseEndedAt: v.optional(v.number()),
      isPauseCutShort: v.optional(v.boolean()),
      totalPauseDurationMs: v.optional(v.number()),
      answers: v.array(
        v.object({
          questionId: v.id("questions"),
          selectedAnswer: v.string(),
          isCorrect: v.boolean(),
        })
      ),
    }),
  },
  handler: async (ctx, { examId, participant }) => {
    // Create participation record
    const participationId = await ctx.db.insert("examParticipations", {
      examId,
      userId: participant.userId,
      score: participant.score,
      completedAt: participant.completedAt,
      startedAt: participant.startedAt,
      status: participant.status,
      pausePhase: participant.pausePhase,
      pauseStartedAt: participant.pauseStartedAt,
      pauseEndedAt: participant.pauseEndedAt,
      isPauseCutShort: participant.isPauseCutShort,
      totalPauseDurationMs: participant.totalPauseDurationMs,
    })

    // Create answer records
    for (const answer of participant.answers) {
      await ctx.db.insert("examAnswers", {
        participationId,
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect: answer.isCorrect,
      })
    }

    return participationId
  },
})

/**
 * Clear migrated participants from exam's embedded array
 * Only call this after confirming migration was successful
 */
export const clearMigratedParticipants = internalMutation({
  args: {
    examId: v.id("exams"),
    migratedUserIds: v.array(v.id("users")),
  },
  handler: async (ctx, { examId, migratedUserIds }) => {
    const exam = await ctx.db.get(examId)
    if (!exam) return

    const migratedSet = new Set(migratedUserIds)
    const remainingParticipants = exam.participants.filter(
      (p) => !migratedSet.has(p.userId)
    )

    await ctx.db.patch(examId, {
      participants: remainingParticipants,
    })

    return {
      originalCount: exam.participants.length,
      remainingCount: remainingParticipants.length,
      removedCount: exam.participants.length - remainingParticipants.length,
    }
  },
})

/**
 * Main migration action - migrates all participants for a batch of exams
 * Run this multiple times until all data is migrated
 */
export const migrateExamParticipants = action({
  args: {
    batchSize: v.optional(v.number()),
    clearAfterMigration: v.optional(v.boolean()),
  },
  handler: async (ctx, { batchSize = 5, clearAfterMigration = false }) => {
    const exams = await ctx.runQuery(internal.migrations.getExamsToMigrate, {
      batchSize,
    })

    if (exams.length === 0) {
      return {
        status: "complete",
        message: "No more exams to migrate",
        migratedExams: 0,
        migratedParticipants: 0,
      }
    }

    let totalMigratedParticipants = 0
    const migratedExamIds: string[] = []
    const errors: Array<{ examId: string; error: string }> = []

    for (const exam of exams) {
      const migratedUserIds: Array<typeof exam.participants[0]["userId"]> = []

      for (const participant of exam.participants) {
        try {
          // Check if already migrated
          const existing = await ctx.runQuery(
            internal.migrations.checkExistingParticipation,
            {
              examId: exam._id,
              userId: participant.userId,
            }
          )

          if (existing) {
            // Already migrated, just track for cleanup
            migratedUserIds.push(participant.userId)
            continue
          }

          // Migrate the participant
          await ctx.runMutation(internal.migrations.migrateParticipant, {
            examId: exam._id,
            participant,
          })

          migratedUserIds.push(participant.userId)
          totalMigratedParticipants++
        } catch (error) {
          errors.push({
            examId: exam._id,
            error: `Failed to migrate user ${participant.userId}: ${error}`,
          })
        }
      }

      // Optionally clear migrated participants from embedded array
      if (clearAfterMigration && migratedUserIds.length > 0) {
        await ctx.runMutation(internal.migrations.clearMigratedParticipants, {
          examId: exam._id,
          migratedUserIds,
        })
      }

      migratedExamIds.push(exam._id)
    }

    return {
      status: "in_progress",
      message: `Migrated ${totalMigratedParticipants} participants from ${migratedExamIds.length} exams`,
      migratedExams: migratedExamIds.length,
      migratedParticipants: totalMigratedParticipants,
      examIds: migratedExamIds,
      errors: errors.length > 0 ? errors : undefined,
    }
  },
})

/**
 * Get migration status - how many exams/participants are left to migrate
 */
export const getMigrationStatus = internalQuery({
  handler: async (ctx) => {
    const exams = await ctx.db.query("exams").collect()

    let totalEmbeddedParticipants = 0
    let examsWithEmbeddedParticipants = 0
    let totalEmbeddedAnswers = 0

    for (const exam of exams) {
      if (exam.participants && exam.participants.length > 0) {
        totalEmbeddedParticipants += exam.participants.length
        examsWithEmbeddedParticipants++
        // Count embedded answers
        for (const p of exam.participants) {
          totalEmbeddedAnswers += p.answers?.length || 0
        }
      }
    }

    // Count V2 records
    const v2Participations = await ctx.db
      .query("examParticipations")
      .collect()

    const v2Answers = await ctx.db.query("examAnswers").collect()

    return {
      v1: {
        examsWithParticipants: examsWithEmbeddedParticipants,
        totalParticipants: totalEmbeddedParticipants,
        totalAnswers: totalEmbeddedAnswers,
      },
      v2: {
        participations: v2Participations.length,
        answers: v2Answers.length,
      },
      migrationComplete: totalEmbeddedParticipants === 0,
    }
  },
})

/**
 * Action to check migration status
 */
export const checkMigrationStatus = action({
  handler: async (ctx): Promise<{
    v1: { examsWithParticipants: number; totalParticipants: number; totalAnswers: number }
    v2: { participations: number; answers: number }
    migrationComplete: boolean
  }> => {
    return await ctx.runQuery(internal.migrations.getMigrationStatus)
  },
})

/**
 * Verify migration integrity - compare V1 embedded data with V2 normalized data
 * Run this BEFORE clearing V1 data to ensure no data was lost
 */
export const verifyMigrationIntegrity = action({
  handler: async (ctx): Promise<{
    isValid: boolean
    issues: string[]
    summary: {
      v1Participants: number
      v2Participants: number
      v1Answers: number
      v2Answers: number
      missingParticipations: number
      missingAnswers: number
    }
  }> => {
    const status = await ctx.runQuery(internal.migrations.getMigrationStatus)
    const issues: string[] = []

    // For each exam with embedded participants, verify V2 records exist
    const verificationResult = await ctx.runQuery(
      internal.migrations.getDetailedVerification
    )

    if (verificationResult.missingParticipations > 0) {
      issues.push(
        `${verificationResult.missingParticipations} participations missing in V2 tables`
      )
    }

    if (verificationResult.missingAnswers > 0) {
      issues.push(
        `${verificationResult.missingAnswers} answers missing in V2 tables`
      )
    }

    if (verificationResult.scoreMismatches.length > 0) {
      issues.push(
        `${verificationResult.scoreMismatches.length} score mismatches found`
      )
    }

    return {
      isValid: issues.length === 0,
      issues,
      summary: {
        v1Participants: status.v1.totalParticipants,
        v2Participants: status.v2.participations,
        v1Answers: status.v1.totalAnswers,
        v2Answers: status.v2.answers,
        missingParticipations: verificationResult.missingParticipations,
        missingAnswers: verificationResult.missingAnswers,
      },
    }
  },
})

/**
 * Internal query for detailed verification
 */
export const getDetailedVerification = internalQuery({
  handler: async (ctx) => {
    const exams = await ctx.db.query("exams").collect()

    let missingParticipations = 0
    let missingAnswers = 0
    const scoreMismatches: Array<{
      examId: string
      userId: string
      v1Score: number
      v2Score: number
    }> = []

    for (const exam of exams) {
      for (const participant of exam.participants || []) {
        // Check if V2 participation exists
        const v2Participation = await ctx.db
          .query("examParticipations")
          .withIndex("by_exam_user", (q) =>
            q.eq("examId", exam._id).eq("userId", participant.userId)
          )
          .unique()

        if (!v2Participation) {
          missingParticipations++
          continue
        }

        // Check score match
        if (v2Participation.score !== participant.score) {
          scoreMismatches.push({
            examId: exam._id,
            userId: participant.userId,
            v1Score: participant.score,
            v2Score: v2Participation.score,
          })
        }

        // Check answers count
        const v2Answers = await ctx.db
          .query("examAnswers")
          .withIndex("by_participation", (q) =>
            q.eq("participationId", v2Participation._id)
          )
          .collect()

        const v1AnswersCount = participant.answers?.length || 0
        if (v2Answers.length !== v1AnswersCount) {
          missingAnswers += Math.abs(v1AnswersCount - v2Answers.length)
        }
      }
    }

    return {
      missingParticipations,
      missingAnswers,
      scoreMismatches,
    }
  },
})

/**
 * Export V1 data to JSON for backup before migration
 * Use this to create a manual backup of embedded participant data
 */
export const exportV1ParticipantData = action({
  handler: async (ctx): Promise<{
    exportedAt: number
    totalExams: number
    totalParticipants: number
    data: Array<{
      examId: string
      examTitle: string
      participants: Array<{
        userId: string
        score: number
        completedAt: number
        startedAt?: number
        status?: string
        answersCount: number
      }>
    }>
  }> => {
    const result = await ctx.runQuery(internal.migrations.getV1DataForExport)
    return {
      exportedAt: Date.now(),
      ...result,
    }
  },
})

/**
 * Internal query to get V1 data for export
 */
export const getV1DataForExport = internalQuery({
  handler: async (ctx) => {
    const exams = await ctx.db.query("exams").collect()

    let totalParticipants = 0
    const data: Array<{
      examId: string
      examTitle: string
      participants: Array<{
        userId: string
        score: number
        completedAt: number
        startedAt?: number
        status?: string
        answersCount: number
      }>
    }> = []

    for (const exam of exams) {
      if (exam.participants && exam.participants.length > 0) {
        totalParticipants += exam.participants.length
        data.push({
          examId: exam._id,
          examTitle: exam.title,
          participants: exam.participants.map((p) => ({
            userId: p.userId,
            score: p.score,
            completedAt: p.completedAt,
            startedAt: p.startedAt,
            status: p.status,
            answersCount: p.answers?.length || 0,
          })),
        })
      }
    }

    return {
      totalExams: data.length,
      totalParticipants,
      data,
    }
  },
})
