import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { createId } from "@/lib/ids"
import { user } from "./auth"
import { examAudienceType, examParticipationStatus } from "./enums"
import { questions } from "./questions"

export const exams = pgTable(
  "exams",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    title: text("title").notNull(),
    description: text("description"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    completionTime: integer("completion_time").notNull(), // SECONDS
    enablePause: boolean("enable_pause").default(false).notNull(),
    pauseDurationMinutes: integer("pause_duration_minutes"),
    isActive: boolean("is_active").default(true).notNull(),
    audienceType: examAudienceType("audience_type")
      .default("subscribers")
      .notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("exams_is_active_idx").on(t.isActive),
    index("exams_start_date_idx").on(t.startDate),
    index("exams_end_date_idx").on(t.endDate),
    index("exams_is_active_start_date_idx").on(t.isActive, t.startDate),
    index("exams_created_by_idx").on(t.createdBy),
  ],
)

// Ordered join (shared exam template). Replaces exams.questionIds[].
export const examQuestions = pgTable(
  "exam_questions",
  {
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.examId, t.questionId] }),
    unique("exam_questions_exam_position_unique").on(t.examId, t.position),
    index("exam_questions_question_id_idx").on(t.questionId),
  ],
)

export const examParticipations = pgTable(
  "exam_participations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: integer("score").default(0).notNull(),
    status: examParticipationStatus("status").default("in_progress").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    resultsNotifiedAt: timestamp("results_notified_at", { withTimezone: true }),
    pauseStartedAt: timestamp("pause_started_at", { withTimezone: true }),
    totalPauseDurationMs: bigint("total_pause_duration_ms", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("exam_participations_exam_user_unique").on(t.examId, t.userId),
    index("exam_participations_exam_id_idx").on(t.examId),
    index("exam_participations_user_id_idx").on(t.userId),
    index("exam_participations_status_idx").on(t.status),
    // Balayage des notifications de résultats : ne cible que le backlog non notifié
    // des examens clos (exclut les `in_progress` jamais marqués).
    index("exam_participations_results_pending_idx")
      .on(t.examId)
      .where(
        sql`${t.status} in ('completed', 'auto_submitted') and ${t.resultsNotifiedAt} is null`,
      ),
  ],
)

export const examAnswers = pgTable(
  "exam_answers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    participationId: text("participation_id")
      .notNull()
      .references(() => examParticipations.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    selectedAnswer: text("selected_answer"), // null tant que non répondu
    isCorrect: boolean("is_correct"), // null tant que non répondu
    isFlagged: boolean("is_flagged").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("exam_answers_participation_question_unique").on(
      t.participationId,
      t.questionId,
    ),
    index("exam_answers_participation_id_idx").on(t.participationId),
    index("exam_answers_question_id_idx").on(t.questionId),
  ],
)

// Audience restreinte d'un examen : la présence d'une ligne (examId, userId)
// OCTROIE l'accès (même sans abonnement). Peuplée uniquement pour les examens
// `audienceType = 'restricted'`.
export const examAudience = pgTable(
  "exam_audience",
  {
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.examId, t.userId] }),
    index("exam_audience_user_id_idx").on(t.userId),
  ],
)
