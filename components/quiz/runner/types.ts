import type { Revealed } from "@/features/questions/answer-key-lock"

export type QuizImage = { url: string; storagePath: string; order: number }

/** Énoncé d'une question, tel que tout canal (entraînement, examen, quiz public) le livre. */
export type QuizStatement = {
  _id: string
  question: string
  options: string[]
  domain: string
  objectifCMC: string
  images: QuizImage[]
}

/**
 * Forme-pont (`CONTEXT.md`) : l'énoncé, plus la correction quand un canal de
 * révélation l'autorise. La partie révélée EST le type de retour du verrou de
 * clé de réponse : elle ne peut pas diverger de ce qu'il blanchit. `keyWithheld`
 * y signale une clé retenue par un examen ouvert : la réponse n'est ni juste
 * ni fausse tant qu'il n'est pas clos.
 */
export type QuizQuestion = QuizStatement & Revealed<QuizImage>

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

/** Ce que le serveur révèle après une réponse en mode tuteur : la correction complète, ou la clé retenue. */
export type QuizRevealPayload =
  | ({ keyWithheld?: undefined } & Required<
      Pick<Revealed<QuizImage>, "correctAnswer" | "explanation" | "references">
    >)
  | { keyWithheld: true }

/**
 * Instant serveur (epoch ms) auquel une action a traité la requête : la seule
 * horloge que le client réactualise après le montage. L'horloge monotone du
 * chrono ne court pas pendant la veille du système, et un retour arrière
 * remonte le runner sur l'instant périmé du rendu initial ; chaque réponse
 * d'action réaligne (voir `useAnchoredClock`).
 */
export type ServerClock = { serverNow?: number }

export type QuizCallbacks = {
  onAnswer: (
    questionId: string,
    selected: string,
  ) => Promise<
    | ({ ok: true; reveal?: QuizRevealPayload } & ServerClock)
    | { ok: false; error: string; timeUp?: boolean }
  >
  // { ok } permet au moteur de rollback le flag local sur échec
  onFlag: (questionId: string, isFlagged: boolean) => Promise<{ ok: boolean }>
  onFinish: (opts: {
    isAutoSubmit: boolean
  }) => Promise<{ ok: boolean; redirectTo?: string }>
  onPause?: () => Promise<{ ok: boolean } & ServerClock>
  // Le serveur renvoie la durée de pause cumulée et plafonnée.
  onResume?: () => Promise<
    { ok: boolean; totalPauseDurationMs?: number } & ServerClock
  >
}
