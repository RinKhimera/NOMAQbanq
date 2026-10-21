import type { DetailExam } from "@/app/(admin)/admin/examens/[id]/_components/exam-detail-model"
import { DAY } from "./time"

/** Examen d'abonnés finalisé, ouvert depuis la veille de `now`. */
export const detailExam = (
  now: number,
  overrides: Partial<DetailExam> = {},
): DetailExam => ({
  id: "exam-1",
  title: "Examen blanc 27",
  description: null,
  startDate: now - DAY,
  endDate: now + 2 * DAY,
  completionTime: 230 * 83,
  finalizedAt: now - 3 * DAY,
  targetQuestionCount: 230,
  isActive: true,
  enablePause: true,
  pauseDurationMinutes: 45,
  questionCount: 230,
  deletedQuestionCount: 0,
  audienceType: "subscribers",
  isHidden: false,
  ...overrides,
})
