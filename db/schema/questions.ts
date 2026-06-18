import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { createId } from "@/lib/ids"

export const questions = pgTable(
  "questions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    question: text("question").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    objectifCmc: text("objectif_cmc").notNull(),
    domain: text("domain").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("questions_domain_idx").on(t.domain),
    index("questions_objectif_cmc_idx").on(t.objectifCmc),
  ],
)

// 1:1 with questions (PK = question_id). Keeps the heavy text out of listings.
export const questionExplanations = pgTable("question_explanations", {
  questionId: text("question_id")
    .primaryKey()
    .references(() => questions.id, { onDelete: "cascade" }),
  explanation: text("explanation").notNull(),
  references: jsonb("references").$type<string[]>(),
})

// Replaces the Convex `images[]` jsonb array (queryable child rows).
export const questionImages = pgTable(
  "question_images",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    storagePath: text("storage_path").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("question_images_question_id_idx").on(t.questionId)],
)
