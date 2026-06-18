import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

import { createId } from "@/lib/ids"

import { user } from "./auth"
import { trainingStatus } from "./enums"
import { questions } from "./questions"

export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: trainingStatus("status").notNull(),
    domain: text("domain"),
    objectifCmc: text("objectif_cmc"),
    questionCount: integer("question_count").notNull(),
    score: integer("score"), // null until completed
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("training_sessions_user_status_idx").on(t.userId, t.status),
    index("training_sessions_user_started_at_idx").on(t.userId, t.startedAt),
    index("training_sessions_status_idx").on(t.status),
    index("training_sessions_status_expires_at_idx").on(t.status, t.expiresAt),
  ],
)

// One row per selected question, carrying its optional answer (single source of truth).
export const trainingSessionItems = pgTable(
  "training_session_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    selectedAnswer: text("selected_answer"), // null until answered
    isCorrect: boolean("is_correct"), // null until answered
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (t) => [
    unique("training_session_items_session_question_unique").on(
      t.sessionId,
      t.questionId,
    ),
    unique("training_session_items_session_position_unique").on(
      t.sessionId,
      t.position,
    ),
    index("training_session_items_session_id_idx").on(t.sessionId),
    index("training_session_items_question_id_idx").on(t.questionId),
  ],
)
