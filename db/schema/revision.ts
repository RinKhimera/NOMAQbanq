import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"
import { createId } from "@/lib/ids"
import { user } from "./auth"
import { questions } from "./questions"

// Signet durable (utilisateur × question), indépendant des sessions : alimente
// le critère « marquées » du corpus de révision.
//
// `onDelete: cascade` sur `question_id`, à rebours des autres FK vers
// `questions` (toutes en `restrict`) : `deleteQuestion` TENTE le hard delete et
// laisse Postgres arbitrer (23001 → repli en soft delete). En `restrict`, un
// seul signet suffirait à transformer tout hard delete en soft delete.
export const questionBookmarks = pgTable(
  "question_bookmarks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("question_bookmarks_user_question_unique").on(
      t.userId,
      t.questionId,
    ),
    index("question_bookmarks_user_id_idx").on(t.userId),
  ],
)
