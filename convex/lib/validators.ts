import { v } from "convex/values"

export const productCodeValidator = v.union(
  v.literal("exam_access"),
  v.literal("training_access"),
  v.literal("exam_access_promo"),
  v.literal("training_access_promo"),
  v.literal("premium_access"),
)

export const accessTypeValidator = v.union(
  v.literal("exam"),
  v.literal("training"),
)

export const currencyValidator = v.union(
  v.literal("CAD"),
  v.literal("XAF"),
)

export const transactionTypeValidator = v.union(
  v.literal("stripe"),
  v.literal("manual"),
)

export const transactionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("refunded"),
)
