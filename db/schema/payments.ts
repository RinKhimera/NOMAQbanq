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
    // precision: 3 (ms) → s'aligne sur la précision de JS Date, sinon la
    // pagination keyset (curseur ms vs colonne µs) saute/dédouble des lignes.
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
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
