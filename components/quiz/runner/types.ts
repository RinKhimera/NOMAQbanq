export type QuizImage = { url: string; storagePath: string; order: number }

export type QuizQuestion = {
  _id: string
  question: string
  options: string[]
  images?: QuizImage[]
  domain?: string
  objectifCMC?: string
  // révélés UNIQUEMENT quand autorisé (tuteur en direct, ou correction)
  correctAnswer?: string
  explanation?: string
  references?: string[]
  explanationImages?: QuizImage[]
  /**
   * Clé retenue par un examen ouvert : la correction est différée à sa
   * clôture. Une réponse à cette question n'est ni juste ni fausse.
   */
  keyWithheld?: true
}

export type AnswerState = { selected: string; isCorrect?: boolean }
export type AnswersMap = Record<string, AnswerState>

export const KEY_WITHHELD_MESSAGE =
  "Correction différée jusqu'à la clôture de l'examen"

/** Score `null` (retenu tant qu'une réponse est en correction différée). */
export const SCORE_WITHHELD_MESSAGE =
  "Score disponible après la clôture de l'examen"

export type QuizMode = {
  kind: "exam" | "training"
  accent: "blue" | "emerald"
  timer: {
    serverStartTime: number
    totalSeconds: number
    /** Horloge serveur du rendu, ancre du premier rendu — voir `useExamTimer`. */
    initialNow: number
  } | null
  pause: "rest" | null
  feedback: "deferred" | "immediate"
  showMeta: boolean
  labels: { title: string; finishCta: string }
  backUrl: string
}

export type QuizRevealPayload =
  | {
      keyWithheld?: undefined
      correctAnswer: string
      explanation: string
      references: string[]
    }
  | { keyWithheld: true }

export type QuizCallbacks = {
  onAnswer: (
    questionId: string,
    selected: string,
  ) => Promise<
    { ok: true; reveal?: QuizRevealPayload } | { ok: false; error: string }
  >
  // { ok } permet au moteur de rollback le flag local sur échec
  onFlag: (questionId: string, isFlagged: boolean) => Promise<{ ok: boolean }>
  onFinish: (opts: {
    isAutoSubmit: boolean
  }) => Promise<{ ok: boolean; redirectTo?: string }>
  onPause?: () => Promise<{ ok: boolean }>
  // Le serveur renvoie la durée de pause cumulée et plafonnée.
  onResume?: () => Promise<{ ok: boolean; totalPauseDurationMs?: number }>
}
