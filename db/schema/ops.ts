import { index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"

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
