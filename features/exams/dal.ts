import "server-only"

export * from "./dal.admin"
export * from "./dal.student"
export type { ExamImageView, ExamQuestionView } from "./dal.shared"
export {
  getOpenExamLockedQuestionIds,
  getOpenExamQuestionIds,
} from "./dal.shared"
