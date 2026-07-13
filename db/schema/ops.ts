import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { createId } from "@/lib/ids"
import { user } from "./auth"
import { uploadType } from "./enums"

// Keyed on user_id (replaces Convex clerkId). Not imported in Phase 3b (ephemeral).
export const uploadRateLimits = pgTable(
  "upload_rate_limits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    uploadType: uploadType("upload_type").notNull(),
    count: integer("count").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("upload_rate_limits_user_type_unique").on(t.userId, t.uploadType),
    index("upload_rate_limits_user_id_idx").on(t.userId),
  ],
)

// Rate-limit ANONYME du quiz marketing (#91) : `key` = HMAC de l'IP (jamais
// l'IP en clair), pas de FK user (l'appelant n'a pas de compte). Purgée par le
// cron close-expired (fenêtres > 24 h).
export const quizRateLimits = pgTable(
  "quiz_rate_limits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    key: text("key").notNull(),
    action: text("action").$type<"load" | "score">().notNull(),
    count: integer("count").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  },
  (t) => [unique("quiz_rate_limits_key_action_unique").on(t.key, t.action)],
)
