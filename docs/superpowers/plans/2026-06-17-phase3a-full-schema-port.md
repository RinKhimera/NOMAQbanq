# Phase 3a — Full schema port (Drizzle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Port the entire Convex data model to Drizzle/Postgres (`db/schema/**`) — enums + content/exams/training/payments/ops domains with real FKs, indexes, and the redesign decisions from the spec — and apply the resulting migration to the Neon `develop` branch. NO data is moved in this plan (that is Phase 3b).

**Architecture:** One file per domain under `db/schema/`, all `pgEnum`s centralized in `db/schema/enums.ts`, FKs with explicit `onDelete`, `text` PKs defaulting to `createId()` (reused Convex `_id`s will be supplied explicitly during the Phase-3b import). The barrel `db/schema/index.ts` re-exports everything so the shared `db` client sees the full model. Migration generated with `drizzle-kit` and applied to `develop` only.

**Tech Stack:** Drizzle ORM 0.45 (`pg-core`) · drizzle-kit 0.31 · Neon Postgres 18 · Bun.

---

## Prerequisites

- On branch `migration/drizzle-neon`. Phase 2 is merged into this branch (auth schema + `db/index.ts` + `lib/ids.ts` exist; first migration applied to `develop`).
- `.env.local` has `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (Neon **develop** branch), etc. (set in Phase 2).
- Neon: target the **develop** branch (`br-restless-morning-ad4uyo3t`) only; never `production`.
- Zscaler: if `db:migrate` fails on TLS, prefix with `$env:NODE_EXTRA_CA_CERTS="C:\Users\samuel.pokam\AppData\Roaming\zscaler-root-ca.pem";` (PowerShell). Phase 2's migrate worked without it.

## Scope notes (read before starting)

- **Deferred to later phases (do NOT add here):** the `questions.search_vector` `tsvector` generated column + GIN index (Phase 5, with the question-search DAL); the `user.role`/`banned`/custom fields + `rate_limit` table (Phase 4); any DAL/Server Actions.
- **Timestamps:** all domain timestamps are `timestamp(..., { withTimezone: true })`. (The Better Auth tables keep their generated plain `timestamp` — do not touch them.)
- **`v.number()` mapping:** counts/scores/prices/durations → `integer`; ms-epoch dates → `timestamp` (the import converts ms→Date in Phase 3b); ms durations (`total_pause_duration_ms`) → `bigint({ mode: "number" })`.
- **PK default:** `text("id").primaryKey().$defaultFn(() => createId())` — new rows get a UUID; the Phase-3b import supplies explicit ids (overriding the default) to preserve FKs.
- **`upload_rate_limits`** keys on `user_id` (FK to `user`), replacing Convex's `clerkId`. It is NOT imported in Phase 3b (ephemeral) — the table just needs to exist.

## File Structure

| File                     | Tables                                                           |
| ------------------------ | ---------------------------------------------------------------- |
| `db/schema/enums.ts`     | all `pgEnum`s                                                    |
| `db/schema/questions.ts` | `questions`, `question_explanations`, `question_images`          |
| `db/schema/exams.ts`     | `exams`, `exam_questions`, `exam_participations`, `exam_answers` |
| `db/schema/training.ts`  | `training_sessions`, `training_session_items`                    |
| `db/schema/payments.ts`  | `products`, `transactions`, `user_access`                        |
| `db/schema/ops.ts`       | `upload_rate_limits`                                             |
| `db/schema/index.ts`     | barrel — re-export all (modified each task)                      |

---

### Task 1: Enums

**Files:** Create `db/schema/enums.ts`; Modify `db/schema/index.ts`.

- [ ] **Step 1: Create `db/schema/enums.ts`**

```ts
import { pgEnum } from "drizzle-orm/pg-core"

export const productCode = pgEnum("product_code", [
  "exam_access",
  "training_access",
  "exam_access_promo",
  "training_access_promo",
  "premium_access",
])
export const accessType = pgEnum("access_type", ["exam", "training"])
export const transactionType = pgEnum("transaction_type", ["stripe", "manual"])
export const transactionStatus = pgEnum("transaction_status", [
  "pending",
  "completed",
  "failed",
])
export const currency = pgEnum("currency", ["CAD", "XAF"])
export const examParticipationStatus = pgEnum("exam_participation_status", [
  "in_progress",
  "completed",
  "auto_submitted",
])
export const examPausePhase = pgEnum("exam_pause_phase", [
  "before_pause",
  "during_pause",
  "after_pause",
])
export const trainingStatus = pgEnum("training_status", [
  "in_progress",
  "completed",
  "abandoned",
])
export const uploadType = pgEnum("upload_type", ["avatar", "question-image"])
```

- [ ] **Step 2: Add to the barrel `db/schema/index.ts`**

Append:

```ts
export * from "./enums"
```

- [ ] **Step 3: Verify**

Run: `bun run check`
Expected: PASS (no type errors, 0 warnings).

- [ ] **Step 4: Commit**

```bash
git add db/schema/enums.ts db/schema/index.ts
git commit -m "feat(db): centralized pg enums for all domains"
```

---

### Task 2: Content domain (`questions`)

**Files:** Create `db/schema/questions.ts`; Modify `db/schema/index.ts`.

- [ ] **Step 1: Create `db/schema/questions.ts`**

```ts
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
```

- [ ] **Step 2: Add to the barrel**

Append to `db/schema/index.ts`:

```ts
export * from "./questions"
```

- [ ] **Step 3: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add db/schema/questions.ts db/schema/index.ts
git commit -m "feat(db): questions, question_explanations, question_images schema"
```

---

### Task 3: Exams domain

**Files:** Create `db/schema/exams.ts`; Modify `db/schema/index.ts`.

- [ ] **Step 1: Create `db/schema/exams.ts`**

```ts
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
import { examParticipationStatus, examPausePhase } from "./enums"
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
    pausePhase: examPausePhase("pause_phase"),
    pauseStartedAt: timestamp("pause_started_at", { withTimezone: true }),
    pauseEndedAt: timestamp("pause_ended_at", { withTimezone: true }),
    isPauseCutShort: boolean("is_pause_cut_short"),
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
    selectedAnswer: text("selected_answer").notNull(),
    isCorrect: boolean("is_correct").notNull(),
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
```

- [ ] **Step 2: Add to the barrel**

Append to `db/schema/index.ts`:

```ts
export * from "./exams"
```

- [ ] **Step 3: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add db/schema/exams.ts db/schema/index.ts
git commit -m "feat(db): exams, exam_questions, exam_participations, exam_answers schema"
```

---

### Task 4: Training domain (redesigned)

**Files:** Create `db/schema/training.ts`; Modify `db/schema/index.ts`.

- [ ] **Step 1: Create `db/schema/training.ts`**

```ts
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
```

- [ ] **Step 2: Add to the barrel**

Append to `db/schema/index.ts`:

```ts
export * from "./training"
```

- [ ] **Step 3: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add db/schema/training.ts db/schema/index.ts
git commit -m "feat(db): training_sessions + training_session_items schema (redesigned)"
```

---

### Task 5: Payments domain

**Files:** Create `db/schema/payments.ts`; Modify `db/schema/index.ts`.

- [ ] **Step 1: Create `db/schema/payments.ts`**

```ts
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { createId } from "@/lib/ids"
import { user } from "./auth"
import {
  accessType,
  currency,
  productCode,
  transactionStatus,
  transactionType,
} from "./enums"

export const products = pgTable(
  "products",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    code: productCode("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    priceCad: integer("price_cad").notNull(), // cents
    durationDays: integer("duration_days").notNull(),
    accessType: accessType("access_type").notNull(),
    stripeProductId: text("stripe_product_id").notNull(),
    stripePriceId: text("stripe_price_id").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isCombo: boolean("is_combo").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("products_code_idx").on(t.code),
    index("products_stripe_product_id_idx").on(t.stripeProductId),
    index("products_is_active_idx").on(t.isActive),
  ],
)

export const transactions = pgTable(
  "transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    type: transactionType("type").notNull(),
    status: transactionStatus("status").notNull(),
    amountPaid: integer("amount_paid").notNull(), // cents
    currency: currency("currency").notNull(),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeEventId: text("stripe_event_id"), // idempotence (unique below)
    paymentMethod: text("payment_method"),
    recordedBy: text("recorded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    accessType: accessType("access_type").notNull(),
    durationDays: integer("duration_days").notNull(),
    accessExpiresAt: timestamp("access_expires_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    // Nullable unique: Postgres allows multiple NULLs (manual txns have no event id).
    uniqueIndex("transactions_stripe_event_id_unique").on(t.stripeEventId),
    index("transactions_user_id_idx").on(t.userId),
    index("transactions_stripe_session_id_idx").on(t.stripeSessionId),
    index("transactions_status_idx").on(t.status),
    index("transactions_type_idx").on(t.type),
    index("transactions_user_access_type_idx").on(t.userId, t.accessType),
    index("transactions_created_at_idx").on(t.createdAt),
    index("transactions_status_created_at_idx").on(t.status, t.createdAt),
  ],
)

export const userAccess = pgTable(
  "user_access",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessType: accessType("access_type").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastTransactionId: text("last_transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("user_access_user_access_type_unique").on(t.userId, t.accessType),
    index("user_access_user_id_idx").on(t.userId),
    index("user_access_expires_at_idx").on(t.expiresAt),
  ],
)
```

- [ ] **Step 2: Add to the barrel**

Append to `db/schema/index.ts`:

```ts
export * from "./payments"
```

- [ ] **Step 3: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add db/schema/payments.ts db/schema/index.ts
git commit -m "feat(db): products, transactions, user_access schema"
```

---

### Task 6: Ops domain

**Files:** Create `db/schema/ops.ts`; Modify `db/schema/index.ts`.

- [ ] **Step 1: Create `db/schema/ops.ts`**

```ts
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
```

- [ ] **Step 2: Add to the barrel**

Append to `db/schema/index.ts`:

```ts
export * from "./ops"
```

- [ ] **Step 3: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add db/schema/ops.ts db/schema/index.ts
git commit -m "feat(db): upload_rate_limits schema"
```

---

### Task 7: Generate & apply the domain migration to `develop`

**Files:** Create `drizzle/0001_*.sql` + `drizzle/meta/**` (generated).

- [ ] **Step 1: Generate**

Run: `bun run db:generate`
Expected: `drizzle/0001_<name>.sql` creating 9 enums (`CREATE TYPE`) and 13 tables (`questions`, `question_explanations`, `question_images`, `exams`, `exam_questions`, `exam_participations`, `exam_answers`, `training_sessions`, `training_session_items`, `products`, `transactions`, `user_access`, `upload_rate_limits`) with their FKs/indexes/uniques.

- [ ] **Step 2: Review the generated SQL**

Open `drizzle/0001_*.sql`. Spot-check:

- `exam_questions` composite PK `(exam_id, question_id)` + unique `(exam_id, position)`.
- `exam_participations` unique `(exam_id, user_id)`.
- `user_access` unique `(user_id, access_type)`.
- `transactions.stripe_event_id` unique index.
- `transactions.user_id`/`product_id`/`user_access.last_transaction_id` FKs `ON DELETE restrict`; `transactions.recorded_by` `ON DELETE set null`; `exam_questions.question_id`/`exam_answers.question_id`/`training_session_items.question_id` `ON DELETE restrict`; child rows (`question_explanations`, `question_images`, `exam_answers`, `exam_participations`, `training_session_items`) `ON DELETE cascade`.
- No `DROP TABLE` of the Phase-2 auth tables.

- [ ] **Step 3: Apply to `develop`**

Run: `bun run db:migrate`
Expected: applies cleanly. (SSL error → set `NODE_EXTRA_CA_CERTS`, see Prerequisites.)

- [ ] **Step 4: Verify on `develop` via Neon MCP**

The controller verifies with the Neon MCP `run_sql` tool against project `lucky-waterfall-33371811`, branch `develop` (`br-restless-morning-ad4uyo3t`):

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

Expected: the 13 domain tables above + the 4 auth tables (`account`, `session`, `user`, `verification`).

And FK sanity:

```sql
SELECT conname FROM pg_constraint WHERE contype = 'f' ORDER BY conname;
```

Expected: FKs for exam_questions, exam_participations, exam_answers, question_explanations, question_images, training_session_items, transactions, user_access, etc.

- [ ] **Step 5: Commit**

```bash
git add drizzle/
git commit -m "feat(db): domain schema migration applied to develop"
```

---

### Task 8: Phase gate

**Files:** none (verification only).

- [ ] **Step 1: Type-check + lint**

Run: `bun run check`
Expected: PASS (0 errors, 0 warnings).

- [ ] **Step 2: Unit tests**

Run: `bun run test`
Expected: PASS (existing 1283 tests unaffected — no new tests in this schema-only phase).

- [ ] **Step 3: Production build**

Run: `bun run build`
Expected: build succeeds (the shared `db` client now imports the full schema barrel).

- [ ] **Step 4: Tag phase completion**

```bash
git commit --allow-empty -m "chore(migration): Phase 3a complete — full schema on develop"
```

---

## Self-Review

**1. Spec coverage (spec §4).** enums §4.1 → Task 1 ✅ · questions/explanations/images §4.3 → Task 2 ✅ · exams/exam_questions/participations/answers §4.4 → Task 3 ✅ · training_sessions/items §4.5 (D9) → Task 4 ✅ · products/transactions/user_access §4.6 → Task 5 ✅ · upload_rate_limits §4.7 → Task 6 ✅ · migration to develop §10 Phase 3 → Task 7 ✅. Deferred-and-noted: `tsvector` full-text (§4.3 → Phase 5), `user.role`/`rate_limit` (§4.2 → Phase 4), data import (§5 → Phase 3b). Dropped tables (§4.8: aggregates, `migrations`, old training tables) correctly absent.

**2. Placeholder scan.** Every table is fully specified with columns/types/FKs/indexes. No TBD/"similar to". ✅

**3. Type/name consistency.** Enum exports (`productCode`, `accessType`, `transactionType`, `transactionStatus`, `currency`, `examParticipationStatus`, `examPausePhase`, `trainingStatus`, `uploadType`) are imported by the exact same names in exams/training/payments/ops. FK targets (`user.id` from `./auth`, `questions.id`, `exams.id`, `examParticipations.id`, `trainingSessions.id`, `products.id`, `transactions.id`) all exist in earlier tasks. Barrel re-exports each new file. `createId` imported from `@/lib/ids` everywhere. ✅

**4. Decisions honored.** D6 `UNIQUE(exam_id,user_id)` ✅ · D7 `questions.deleted_at` archive ✅ · D8 `createId` PK default (import overrides) ✅ · D9 training 2-table ✅ · completion_time integer SECONDS ✅ · transactions RESTRICT to user, recorded_by SET NULL ✅.
