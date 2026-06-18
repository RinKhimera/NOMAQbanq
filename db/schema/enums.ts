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
