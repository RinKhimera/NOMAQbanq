import { sql } from "drizzle-orm"
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
    // Clé de prix Stripe, IDENTIQUE en test et en live — contrairement aux
    // `price_…`, dont le préfixe n'encode pas le mode. C'est elle qui résout le
    // prix au checkout ; `stripePriceId` n'est plus qu'un repli le temps de la
    // bascule.
    stripePriceLookupKey: text("stripe_price_lookup_key").notNull(),
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
    // Montant réellement présenté au client par Adaptive Pricing, dans SA devise.
    // Texte libre et non l'enum `currency` : la conversion couvre plus de 150 pays,
    // contraindre ici perdrait la donnée qu'on cherche à capturer. Nul quand le
    // client a payé dans la devise d'intégration. Ces colonnes ne sont PAS
    // comptables : `amountPaid`/`currency` restent le montant d'encaissement.
    presentmentAmount: integer("presentment_amount"),
    presentmentCurrency: text("presentment_currency"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeEventId: text("stripe_event_id"), // idempotence (unique below)
    // Litige courant rattaché par `stripe_payment_intent_id`. Un paiement
    // peut recevoir plusieurs litiges : l'id distingue une redélivrance d'un
    // nouveau litige. Statut en texte libre : l'enum Stripe peut s'étendre,
    // une valeur inconnue ne doit pas faire échouer le webhook.
    stripeDisputeId: text("stripe_dispute_id"),
    disputeStatus: text("dispute_status"),
    // Preuve d'envoi du courriel de confirmation (MessageId SES) : seule clé
    // qui relie une transaction à une entrée du journal SES.
    confirmationEmailMessageId: text("confirmation_email_message_id"),
    confirmationEmailSentAt: timestamp("confirmation_email_sent_at", {
      withTimezone: true,
    }),
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
    expiryReminderSentAt: timestamp("expiry_reminder_sent_at", {
      withTimezone: true,
    }),
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
    // Rappel de fin d'accès : le range-scan sur `expiresAt` borne la fenêtre ; le
    // prédicat partiel écarte les lignes déjà rappelées.
    index("user_access_expiry_reminder_pending_idx")
      .on(t.expiresAt)
      .where(sql`${t.expiryReminderSentAt} is null`),
  ],
)
