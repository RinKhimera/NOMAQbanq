# Phase 3b — Data migration (Convex prod → Neon develop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply the remaining pre-import schema changes (extend `user`/`session` + `rate_limit`; `question_images` path-only; `question_explanations` explanation image), then import the Convex **production** snapshot into the Neon **develop** branch via an idempotent script, and verify row counts + orphan handling.

**Architecture:** A throwaway Bun script reads the extracted Convex snapshot (`convex-snapshot/<table>/documents.jsonl`), maps each document to a Drizzle row **in FK order**, filters orphan references, and bulk-inserts in batches with `onConflictDoNothing` (relaunchable). Convex `_id` is reused as the `text` PK so all relations survive without an id-map. Runs against `DATABASE_URL_UNPOOLED` (direct connection, develop branch).

**Tech Stack:** Drizzle ORM 0.45 · `pg` · Bun · Neon Postgres 18.

---

## Prerequisites

- On branch `migration/drizzle-neon`. Phases 2 + 3a done (17 tables on `develop`).
- The prod snapshot is already exported and extracted: `convex-snapshot.zip` + `convex-snapshot/` (gitignored). Source counts (verification targets): users 184, questions 2880, questionExplanations 2880, exams 21, examParticipations 195, examAnswers 25221, trainingParticipations 373, trainingAnswers 4572, products 5, transactions 66, userAccess 37. NOT migrated: uploadRateLimits, aggregates, migrations.
- `.env.local` has `DATABASE_URL_UNPOOLED` (develop, direct). Target **develop only**.

## Decisions baked in

- **`user.image` stores the Bunny PATH** (Proxéa model), falling back to the external (Clerk) URL when no Bunny path exists. **No `avatar_storage_path` column.**
- **`question_images`: `url` column dropped** (path-only; URL derived at render). Keep `storage_path`.
- **`question_explanations.image_path`** (nullable) = optional explanation figure, shown ONLY in post-exam/training review (the explanations table is lazy-loaded in review flows). Null for all migrated rows (admins add them later via the upload flow).
- **`user` extended to the Better Auth admin shape** (role enum, ban fields, soft-delete) now, so Phase 4 needs no further user migration.
- Training `in_progress` sessions are **not migrated** (D9, ephemeral). `completed_at == 0` → `null`.

---

### Task 1: Pre-import schema changes + migration to develop

**Files:** Modify `db/schema/enums.ts`, `db/schema/auth.ts`, `db/schema/questions.ts`; generate `drizzle/0002_*.sql`.

- [ ] **Step 1: Add the `user_role` enum** — append to `db/schema/enums.ts`:

```ts
export const userRole = pgEnum("user_role", ["user", "admin"])
```

- [ ] **Step 2: Replace `db/schema/auth.ts`** with the extended Better Auth schema (adds user custom fields + ban + soft-delete, `session.impersonated_by`, `rate_limit` table). New columns use `withTimezone` for the added timestamps; existing columns are unchanged (no ALTER):

```ts
import { relations } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { userRole } from "./enums"

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: userRole("role").default("user").notNull(),
    username: text("username").unique(),
    bio: text("bio"),
    banned: boolean("banned").default(false).notNull(),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("user_role_idx").on(t.role)],
)

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    impersonatedBy: text("impersonated_by"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
)

export const rateLimit = pgTable(
  "rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (t) => [index("rate_limit_key_idx").on(t.key)],
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))
```

- [ ] **Step 3: Edit `db/schema/questions.ts`** — in `questionImages`, **remove the `url` line**; in `questionExplanations`, **add `imagePath`**. The two tables become:

```ts
export const questionExplanations = pgTable("question_explanations", {
  questionId: text("question_id")
    .primaryKey()
    .references(() => questions.id, { onDelete: "cascade" }),
  explanation: text("explanation").notNull(),
  references: jsonb("references").$type<string[]>(),
  imagePath: text("image_path"), // figure d'explication (review only); URL dérivée au rendu
})

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("question_images_question_id_idx").on(t.questionId)],
)
```

- [ ] **Step 4: Verify** — `bun run check` (PASS, 0 warnings).

- [ ] **Step 5: Generate + review the migration** — `bun run db:generate`. Confirm `drizzle/0002_*.sql`: `CREATE TYPE "user_role"`; `ALTER TABLE "user" ADD COLUMN role/username/bio/banned/ban_reason/ban_expires/deleted_at/anonymized_at`; `ALTER TABLE "session" ADD COLUMN impersonated_by`; `CREATE TABLE "rate_limit"`; `ALTER TABLE "question_images" DROP COLUMN "url"`; `ALTER TABLE "question_explanations" ADD COLUMN "image_path"`. No unexpected drops.

- [ ] **Step 6: Apply to develop** — `bun run db:migrate` (set `NODE_EXTRA_CA_CERTS` only if SSL error).

- [ ] **Step 7: Commit**

```bash
git add db/schema/ drizzle/
git commit -m "feat(db): extend user (admin fields) + image_path on explanations + drop question_images.url"
```

---

### Task 2: Write the import script

**Files:** Create `scripts/import-from-convex.ts`.

- [ ] **Step 1: Create `scripts/import-from-convex.ts`**

```ts
// Idempotent one-shot import: Convex snapshot -> Neon (develop).
// Usage: bun run scripts/import-from-convex.ts [snapshotDir=convex-snapshot]
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/node-postgres"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Pool } from "pg"
import * as schema from "@/db/schema"
import { createId } from "@/lib/ids"

config({ path: ".env.local" })

const SNAPSHOT = process.argv[2] ?? "convex-snapshot"
const BATCH = 500

const url = process.env.DATABASE_URL_UNPOOLED
if (!url) throw new Error("DATABASE_URL_UNPOOLED manquant (.env.local)")
const pool = new Pool({ connectionString: url })
const db = drizzle(pool, { schema })

type Doc = Record<string, any>

const read = (table: string): Doc[] => {
  const p = join(SNAPSHOT, table, "documents.jsonl")
  if (!existsSync(p)) {
    console.warn(`[skip] ${table}: documents.jsonl introuvable`)
    return []
  }
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Doc)
}

const ms = (n: number | null | undefined): Date | null =>
  n == null ? null : new Date(n)

const insertBatched = async (
  table: any,
  rows: any[],
  label: string,
): Promise<void> => {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    if (chunk.length > 0)
      await db.insert(table).values(chunk).onConflictDoNothing()
  }
  console.log(`[ok] ${label}: ${rows.length} lignes`)
}

const report: Record<string, number> = {}
const dropped: string[] = []
const note = (msg: string) => {
  dropped.push(msg)
  console.warn(`[orphan] ${msg}`)
}

async function main() {
  // 1. products (no FK)
  const products = read("products").map((d) => ({
    id: d._id,
    code: d.code,
    name: d.name,
    description: d.description,
    priceCad: d.priceCAD,
    durationDays: d.durationDays,
    accessType: d.accessType,
    stripeProductId: d.stripeProductId,
    stripePriceId: d.stripePriceId,
    isActive: d.isActive,
    isCombo: d.isCombo ?? false,
    createdAt: ms(d._creationTime),
    updatedAt: ms(d._creationTime),
  }))
  const productIds = new Set(products.map((p) => p.id))
  await insertBatched(schema.products, products, "products")
  report.products = products.length

  // 2. questions + 3. explanations + 4. question_images
  const questionDocs = read("questions")
  const questionIds = new Set(questionDocs.map((d) => d._id))
  const questions = questionDocs.map((d) => ({
    id: d._id,
    question: d.question,
    correctAnswer: d.correctAnswer,
    options: d.options,
    objectifCmc: d.objectifCMC,
    domain: d.domain,
    deletedAt: null,
    createdAt: ms(d._creationTime),
    updatedAt: ms(d._creationTime),
  }))
  await insertBatched(schema.questions, questions, "questions")
  report.questions = questions.length

  const questionImages: any[] = []
  for (const d of questionDocs) {
    if (Array.isArray(d.images)) {
      for (const img of d.images) {
        questionImages.push({
          id: createId(),
          questionId: d._id,
          storagePath: img.storagePath,
          position: img.order,
          createdAt: ms(d._creationTime),
        })
      }
    }
  }
  await insertBatched(schema.questionImages, questionImages, "question_images")
  report.question_images = questionImages.length

  const explanations = read("questionExplanations")
    .filter((d) => {
      if (questionIds.has(d.questionId)) return true
      note(`explanation ${d._id} -> question ${d.questionId} absente`)
      return false
    })
    .map((d) => ({
      questionId: d.questionId,
      explanation: d.explanation,
      references: d.references ?? null,
      imagePath: null,
    }))
  await insertBatched(
    schema.questionExplanations,
    explanations,
    "question_explanations",
  )
  report.question_explanations = explanations.length

  // 5. users (dedup email + username)
  const userDocs = read("users")
  const seenEmail = new Set<string>()
  const seenUsername = new Set<string>()
  const users: any[] = []
  for (const d of userDocs) {
    if (seenEmail.has(d.email)) {
      note(`user ${d._id}: email "${d.email}" doublon -> ignoré`)
      continue
    }
    seenEmail.add(d.email)
    let username: string | null = d.username ?? null
    if (username && seenUsername.has(username)) {
      note(`user ${d._id}: username "${username}" doublon -> null`)
      username = null
    }
    if (username) seenUsername.add(username)
    users.push({
      id: d._id,
      name: d.name,
      email: d.email,
      emailVerified: true,
      // Proxéa: store the Bunny path; fall back to external (Clerk) URL.
      image: d.avatarStoragePath ?? d.image ?? null,
      role: d.role,
      username,
      bio: d.bio ?? null,
      createdAt: ms(d._creationTime),
      updatedAt: ms(d._creationTime),
    })
  }
  const userIds = new Set(users.map((u) => u.id))
  await insertBatched(schema.user, users, "user")
  report.user = users.length

  // 6. exams + 7. exam_questions
  const examDocs = read("exams")
  const exams: any[] = []
  for (const d of examDocs) {
    if (!userIds.has(d.createdBy)) {
      note(`exam ${d._id}: createdBy ${d.createdBy} absent -> ignoré`)
      continue
    }
    exams.push({
      id: d._id,
      title: d.title,
      description: d.description ?? null,
      startDate: ms(d.startDate),
      endDate: ms(d.endDate),
      completionTime: d.completionTime,
      enablePause: d.enablePause ?? false,
      pauseDurationMinutes: d.pauseDurationMinutes ?? null,
      isActive: d.isActive,
      createdBy: d.createdBy,
      createdAt: ms(d._creationTime),
      updatedAt: ms(d._creationTime),
    })
  }
  const examIds = new Set(exams.map((e) => e.id))
  await insertBatched(schema.exams, exams, "exams")
  report.exams = exams.length

  const examQuestions: any[] = []
  for (const d of examDocs) {
    if (!examIds.has(d._id)) continue
    const ids: string[] = Array.isArray(d.questionIds) ? d.questionIds : []
    ids.forEach((qid, position) => {
      if (!questionIds.has(qid)) {
        note(`exam ${d._id}: question ${qid} absente -> lien ignoré`)
        return
      }
      examQuestions.push({ examId: d._id, questionId: qid, position })
    })
  }
  await insertBatched(schema.examQuestions, examQuestions, "exam_questions")
  report.exam_questions = examQuestions.length

  // 8. transactions
  const transactions: any[] = []
  for (const d of read("transactions")) {
    if (!userIds.has(d.userId)) {
      note(`transaction ${d._id}: user ${d.userId} absent -> ignoré`)
      continue
    }
    if (!productIds.has(d.productId)) {
      note(`transaction ${d._id}: product ${d.productId} absent -> ignoré`)
      continue
    }
    transactions.push({
      id: d._id,
      userId: d.userId,
      productId: d.productId,
      type: d.type,
      status: d.status,
      amountPaid: d.amountPaid,
      currency: d.currency,
      stripeSessionId: d.stripeSessionId ?? null,
      stripePaymentIntentId: d.stripePaymentIntentId ?? null,
      stripeEventId: d.stripeEventId ?? null,
      paymentMethod: d.paymentMethod ?? null,
      recordedBy:
        d.recordedBy && userIds.has(d.recordedBy) ? d.recordedBy : null,
      notes: d.notes ?? null,
      accessType: d.accessType,
      durationDays: d.durationDays,
      accessExpiresAt: ms(d.accessExpiresAt),
      createdAt: ms(d.createdAt),
      completedAt: d.completedAt ? ms(d.completedAt) : null,
    })
  }
  const transactionIds = new Set(transactions.map((t) => t.id))
  await insertBatched(schema.transactions, transactions, "transactions")
  report.transactions = transactions.length

  // 9. user_access
  const userAccess: any[] = []
  for (const d of read("userAccess")) {
    if (!userIds.has(d.userId)) {
      note(`userAccess ${d._id}: user ${d.userId} absent -> ignoré`)
      continue
    }
    if (!transactionIds.has(d.lastTransactionId)) {
      note(
        `userAccess ${d._id}: transaction ${d.lastTransactionId} absente -> ignoré`,
      )
      continue
    }
    userAccess.push({
      id: d._id,
      userId: d.userId,
      accessType: d.accessType,
      expiresAt: ms(d.expiresAt),
      lastTransactionId: d.lastTransactionId,
      createdAt: ms(d._creationTime),
      updatedAt: ms(d._creationTime),
    })
  }
  await insertBatched(schema.userAccess, userAccess, "user_access")
  report.user_access = userAccess.length

  // 10. exam_participations
  const participations: any[] = []
  for (const d of read("examParticipations")) {
    if (!examIds.has(d.examId)) {
      note(`examParticipation ${d._id}: exam ${d.examId} absent -> ignoré`)
      continue
    }
    if (!userIds.has(d.userId)) {
      note(`examParticipation ${d._id}: user ${d.userId} absent -> ignoré`)
      continue
    }
    participations.push({
      id: d._id,
      examId: d.examId,
      userId: d.userId,
      score: d.score,
      status: d.status ?? "in_progress",
      startedAt: d.startedAt ? ms(d.startedAt) : null,
      completedAt:
        d.completedAt && d.completedAt !== 0 ? ms(d.completedAt) : null,
      pausePhase: d.pausePhase ?? null,
      pauseStartedAt: d.pauseStartedAt ? ms(d.pauseStartedAt) : null,
      pauseEndedAt: d.pauseEndedAt ? ms(d.pauseEndedAt) : null,
      isPauseCutShort: d.isPauseCutShort ?? null,
      totalPauseDurationMs: d.totalPauseDurationMs ?? null,
      createdAt: ms(d._creationTime),
    })
  }
  const participationIds = new Set(participations.map((p) => p.id))
  await insertBatched(
    schema.examParticipations,
    participations,
    "exam_participations",
  )
  report.exam_participations = participations.length

  // 11. exam_answers
  const examAnswers: any[] = []
  for (const d of read("examAnswers")) {
    if (!participationIds.has(d.participationId)) continue
    if (!questionIds.has(d.questionId)) {
      note(`examAnswer ${d._id}: question ${d.questionId} absente -> ignoré`)
      continue
    }
    examAnswers.push({
      id: d._id,
      participationId: d.participationId,
      questionId: d.questionId,
      selectedAnswer: d.selectedAnswer,
      isCorrect: d.isCorrect,
      isFlagged: d.isFlagged ?? false,
      createdAt: ms(d._creationTime),
    })
  }
  await insertBatched(schema.examAnswers, examAnswers, "exam_answers")
  report.exam_answers = examAnswers.length

  // 12. training_sessions (skip in_progress — D9)
  const trainingSessions: any[] = []
  const sessionQuestionIds = new Map<string, string[]>()
  let skippedInProgress = 0
  for (const d of read("trainingParticipations")) {
    if (!userIds.has(d.userId)) {
      note(`trainingParticipation ${d._id}: user ${d.userId} absent -> ignoré`)
      continue
    }
    if (d.status === "in_progress") {
      skippedInProgress++
      continue
    }
    trainingSessions.push({
      id: d._id,
      userId: d.userId,
      status: d.status,
      domain: d.domain ?? null,
      objectifCmc: null,
      questionCount: d.questionCount,
      score: d.score ?? null,
      startedAt: ms(d.startedAt),
      completedAt: d.completedAt ? ms(d.completedAt) : null,
      expiresAt: ms(d.expiresAt),
      createdAt: ms(d._creationTime),
      updatedAt: ms(d._creationTime),
    })
    sessionQuestionIds.set(
      d._id,
      Array.isArray(d.questionIds) ? d.questionIds : [],
    )
  }
  const sessionIds = new Set(trainingSessions.map((s) => s.id))
  await insertBatched(
    schema.trainingSessions,
    trainingSessions,
    "training_sessions",
  )
  report.training_sessions = trainingSessions.length
  if (skippedInProgress > 0)
    console.log(
      `[info] ${skippedInProgress} sessions training in_progress non migrées`,
    )

  // 13. training_session_items: build from session questionIds[], merge answers
  const answerByKey = new Map<string, Doc>()
  for (const a of read("trainingAnswers")) {
    if (sessionIds.has(a.participationId)) {
      answerByKey.set(`${a.participationId}::${a.questionId}`, a)
    }
  }
  const items: any[] = []
  for (const [sessionId, qids] of sessionQuestionIds) {
    qids.forEach((qid, position) => {
      if (!questionIds.has(qid)) {
        note(`training ${sessionId}: question ${qid} absente -> item ignoré`)
        return
      }
      const a = answerByKey.get(`${sessionId}::${qid}`)
      items.push({
        id: createId(),
        sessionId,
        questionId: qid,
        position,
        selectedAnswer: a ? a.selectedAnswer : null,
        isCorrect: a ? a.isCorrect : null,
        answeredAt: a ? ms(a._creationTime) : null,
      })
    })
  }
  await insertBatched(
    schema.trainingSessionItems,
    items,
    "training_session_items",
  )
  report.training_session_items = items.length

  console.log("\n=== RÉSUMÉ IMPORT ===")
  console.table(report)
  console.log(`Orphelins/doublons ignorés: ${dropped.length}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Verify it type-checks** — `bun run check` (PASS).

- [ ] **Step 3: Commit**

```bash
git add scripts/import-from-convex.ts
git commit -m "feat(migration): Convex->Neon import script (FK order, orphan-safe, idempotent)"
```

---

### Task 3: Run the import on develop + verify

**Files:** none (data operation + verification).

- [ ] **Step 1: Run the import**

Run: `bun run scripts/import-from-convex.ts`
Expected: per-table `[ok]` lines, a `RÉSUMÉ IMPORT` table, and an orphan/dup count. No thrown errors. (Re-runnable: a second run inserts 0 new rows — `onConflictDoNothing` on PKs.)

- [ ] **Step 2: Verify row counts on develop (controller, via Neon MCP `run_sql`, branch `br-restless-morning-ad4uyo3t`)**

```sql
SELECT 'user' t, count(*) n FROM "user"
UNION ALL SELECT 'questions', count(*) FROM questions
UNION ALL SELECT 'question_explanations', count(*) FROM question_explanations
UNION ALL SELECT 'question_images', count(*) FROM question_images
UNION ALL SELECT 'exams', count(*) FROM exams
UNION ALL SELECT 'exam_questions', count(*) FROM exam_questions
UNION ALL SELECT 'exam_participations', count(*) FROM exam_participations
UNION ALL SELECT 'exam_answers', count(*) FROM exam_answers
UNION ALL SELECT 'training_sessions', count(*) FROM training_sessions
UNION ALL SELECT 'training_session_items', count(*) FROM training_session_items
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'transactions', count(*) FROM transactions
UNION ALL SELECT 'user_access', count(*) FROM user_access
ORDER BY t;
```

Expected vs Convex source (allowing documented orphan/dedup drops): user ≈184, questions 2880, question_explanations 2880, exams 21, exam_participations ≤195, exam_answers ≤25221, training_sessions = 373 − (in_progress count), products 5, transactions ≤66, user_access ≤37. Any gap must be explained by an `[orphan]`/dedup log line from Step 1.

- [ ] **Step 3: Orphan FK sanity (should all return 0)**

```sql
SELECT
  (SELECT count(*) FROM exam_answers a LEFT JOIN questions q ON q.id=a.question_id WHERE q.id IS NULL) AS exam_ans_orphans,
  (SELECT count(*) FROM exam_questions eq LEFT JOIN questions q ON q.id=eq.question_id WHERE q.id IS NULL) AS exam_q_orphans,
  (SELECT count(*) FROM training_session_items i LEFT JOIN questions q ON q.id=i.question_id WHERE q.id IS NULL) AS train_item_orphans,
  (SELECT count(*) FROM user_access ua LEFT JOIN transactions t ON t.id=ua.last_transaction_id WHERE t.id IS NULL) AS access_tx_orphans;
```

Expected: all `0` (FK constraints guarantee this; a non-zero would mean a constraint was missing).

- [ ] **Step 4: Spot-check one exam's question order**

```sql
SELECT position, question_id FROM exam_questions
WHERE exam_id = (SELECT id FROM exams LIMIT 1) ORDER BY position;
```

Expected: contiguous-ish positions starting at 0, matching the source exam's `questionIds[]` order.

- [ ] **Step 5: Tag phase completion**

```bash
git commit --allow-empty -m "chore(migration): Phase 3b complete — prod data imported into develop"
```

---

## Self-Review

**1. Spec coverage (spec §5).** Export already done; FK-ordered import → Task 2 ✅; `_id`→PK, `_creationTime`→created_at, `completedAt 0→null`, images[]→question_images, exam questionIds[]→exam_questions, training questionIds[]+trainingAnswers→training_session_items → Task 2 ✅; batched + onConflictDoNothing (relaunchable) ✅; verify counts + orphan scan → Task 3 ✅; in_progress training skipped, upload_rate_limits/aggregates not migrated ✅. User extension (Proxéa shape) + question_images path-only + explanation image → Task 1 ✅.

**2. Placeholder scan.** Full script, full schema, exact SQL. No TBD. ✅

**3. Type/name consistency.** Script uses `schema.products/questions/questionImages/questionExplanations/user/exams/examQuestions/transactions/userAccess/examParticipations/examAnswers/trainingSessions/trainingSessionItems` — all exported by the barrel (Phase 3a + Task 1). Convex field names (`priceCAD`, `objectifCMC`, `questionIds`, `avatarStoragePath`, `order`) mapped to the target columns. FK-order sets (`productIds`, `questionIds`, `userIds`, `examIds`, `transactionIds`, `participationIds`, `sessionIds`) built before dependents. ✅

**4. Risk notes.** Develop is throwaway (resettable from `production` parent if the import needs a clean re-run after a schema fix). Email dedup may drop a user (logged); username dedup nulls duplicates (logged). `objectif_cmc` is null for migrated training sessions (Convex never stored it on the participation).
