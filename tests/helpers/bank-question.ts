import type { BankQuestion } from "@/features/questions/dal"
import { DAY } from "./time"

export const COMPOSER_NOW = Date.UTC(2026, 8, 30, 14)

export const bankQuestion = (
  id: string,
  overrides: Partial<BankQuestion> = {},
): BankQuestion => ({
  id,
  question: `Énoncé ${id}`,
  domain: "Cardiologie",
  objectifCMC: "Douleur thoracique",
  options: ["A", "B", "C", "D"],
  createdAt: COMPOSER_NOW - 30 * DAY,
  updatedAt: COMPOSER_NOW - 30 * DAY,
  imageCount: 0,
  usageCount: 0,
  answerCount: 0,
  successRate: null,
  keyToVerify: false,
  lastUse: null,
  deleted: false,
  ...overrides,
})
