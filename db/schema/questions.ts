import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { createId } from "@/lib/ids"
import { questionImageKind } from "./enums"

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
    // precision 3 (ms) : la pagination keyset encode le curseur via toISOString
    // (ms) ; le driver pg tronque aussi les lectures à la ms. Sans cette borne,
    // `defaultNow()` écrit en µs et des lignes sont sautées aux frontières de
    // page (même classe que le bug H2 sur transactions.created_at).
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
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
    storagePath: text("storage_path").notNull(),
    position: integer("position").notNull(),
    kind: questionImageKind("kind").default("statement").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("question_images_question_id_idx").on(t.questionId),
    index("question_images_question_kind_idx").on(t.questionId, t.kind),
  ],
)
