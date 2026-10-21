import type {
  AdminTransactionView,
  TransactionClientFile,
  TransactionClientRow,
  TransactionClientsPage,
  TransactionStatsView,
} from "@/features/payments/dal"

export const NOW = Date.UTC(2026, 9, 18, 12)
const DAY = 24 * 60 * 60 * 1000

export const makeTx = (
  overrides: Partial<AdminTransactionView> = {},
): AdminTransactionView => ({
  id: "tx-1",
  type: "stripe",
  status: "completed",
  amountPaid: 5000,
  currency: "CAD",
  presentmentAmount: null,
  presentmentCurrency: null,
  accessType: "exam",
  isCombo: false,
  durationDays: 30,
  accessExpiresAt: NOW + 20 * DAY,
  createdAt: NOW - 10 * DAY,
  completedAt: NOW - 10 * DAY,
  refundedAt: null,
  paymentMethod: null,
  notes: null,
  recordedByName: null,
  confirmationEmailSentAt: null,
  disputeStatus: null,
  stripePaymentIntentId: "pi_1",
  stripeSessionId: "cs_1",
  stripeDisputeId: null,
  stripeUrl: "https://dashboard.stripe.com/test/payments/pi_1",
  product: { id: "p1", code: "exam_access", name: "Accès Examens · 1 mois" },
  user: { id: "u1", name: "Chloé Tremblay", email: "chloe@example.com" },
  ...overrides,
})

export const makeFile = (
  overrides: Partial<TransactionClientFile> = {},
): TransactionClientFile => ({
  client: {
    id: "u1",
    name: "Chloé Tremblay",
    email: "chloe@example.com",
    image: null,
    deleted: false,
  },
  access: { exam: null, training: null },
  refunded: { exam: false, training: false },
  verdict: { kind: "completed", completedAt: NOW - 10 * DAY, manual: false },
  transactionCount: 1,
  timeline: { items: [makeTx()], nextCursor: null },
  ...overrides,
})

export const makeClientRow = (
  overrides: Partial<TransactionClientRow> = {},
): TransactionClientRow => ({
  userId: "u1",
  name: "Chloé Tremblay",
  email: "chloe@example.com",
  image: null,
  lastActivityAt: NOW - DAY,
  transactionCount: 2,
  lastStatus: "completed",
  openDispute: false,
  ...overrides,
})

export const makeClientsPage = (
  overrides: Partial<TransactionClientsPage> = {},
): TransactionClientsPage => ({
  items: [makeClientRow()],
  total: 1,
  firstIndex: 0,
  prevCursor: null,
  nextCursor: null,
  counts: { failed: 0, dispute: 0, manual: 0 },
  ...overrides,
})

export const makeStats = (
  overrides: Partial<TransactionStatsView> = {},
): TransactionStatsView => ({
  revenueByCurrency: {
    CAD: { total: 150000, recent: 5000 },
    XAF: { total: 0, recent: 0 },
  },
  buyerCount: 3,
  transactionCount: 4,
  ...overrides,
})
