import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { createId } from "@/lib/ids"
import { user } from "./auth"
import { questionImageKind } from "./enums"

/**
 * Référentiel des objectifs du CMC (`CONTEXT.md`). Deux objectifs valides ne
 * partagent jamais une clé normalisée : l'application le vérifie pour proposer
 * l'objectif existant, l'index partiel le garantit. Les valeurs invalides
 * (`needs_fix`) en sont exclues : elles se réduisent souvent à une clé vide.
 */
export const cmcObjectives = pgTable(
  "cmc_objectives",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    label: text("label").notNull(),
    /**
     * `objectiveKey(label)`, écrite par l'application à chaque écriture de
     * libellé : la clé JS n'a pas d'équivalent exact en SQL.
     */
    normalizedKey: text("normalized_key").notNull(),
    /** Valeur invalide héritée de la saisie libre : jamais proposée. */
    needsFix: boolean("needs_fix").default(false).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("cmc_objectives_label_key").on(t.label),
    uniqueIndex("cmc_objectives_normalized_key_key")
      .on(t.normalizedKey)
      .where(sql`${t.needsFix} = false`),
  ],
)

export const questions = pgTable(
  "questions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    question: text("question").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    objectiveId: text("objective_id")
      .notNull()
      .references(() => cmcObjectives.id, { onDelete: "restrict" }),
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
    // Clé confirmée : seule la dernière confirmation est gardée. Effacée par
    // toute modification de l'énoncé, des options ou de la clé.
    keyConfirmedAt: timestamp("key_confirmed_at", { withTimezone: true }),
    keyConfirmedBy: text("key_confirmed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    keyConfirmedAnswerCount: integer("key_confirmed_answer_count"),
    keyConfirmedNote: text("key_confirmed_note"),
  },
  (t) => [
    index("questions_domain_idx").on(t.domain),
    index("questions_objective_id_idx").on(t.objectiveId),
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

// Lignes enfants requêtables, une par image de question.
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
