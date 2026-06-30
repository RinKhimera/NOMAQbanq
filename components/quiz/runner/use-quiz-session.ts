"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import type {
  AnswersMap,
  QuizCallbacks,
  QuizMode,
  QuizQuestion,
  QuizRevealPayload,
} from "./types"
import { useExamTimer } from "./use-exam-timer"

export type UseQuizSessionOptions = {
  questions: QuizQuestion[]
  initialAnswers: AnswersMap
  initialFlags?: Set<string>
  // État de pause initial (réhydraté depuis ExamSessionView à la reprise).
  initialPause?: { isPaused: boolean; totalPauseDurationMs: number }
  // Pré-révélations à hydrater au montage (mode tuteur : questions déjà répondues).
  initialRevealed?: Record<string, QuizRevealPayload>
  mode: QuizMode
  callbacks: QuizCallbacks
}

export type UseQuizSessionResult = {
  // Navigation
  currentIndex: number
  currentQuestion: QuizQuestion | undefined
  goNext: () => void
  goPrevious: () => void
  goTo: (index: number) => void

  // Answers
  answers: AnswersMap
  answeredCount: number
  answerSelect: (optionIndex: number) => Promise<void>

  // Flags
  flagged: Set<string>
  toggleFlag: () => void

  // Reveal (immediate feedback mode)
  revealed: Record<string, QuizRevealPayload>

  // Sélection en attente (mode tuteur : choisie mais pas encore validée)
  pendingSelection: Record<string, string>
  // Valide la sélection en attente de la question courante (mode tuteur)
  confirmAnswer: () => Promise<void>

  // Finish dialog
  finishDialogOpen: boolean
  isSubmitting: boolean
  requestFinish: () => void
  confirmFinish: (opts?: { isAutoSubmit?: boolean }) => Promise<void>
  setFinishDialogOpen: (open: boolean) => void

  // Pause (rest break) — freezes the timer
  isPaused: boolean
  // True once the single rest pause has been consumed (used at mount if the
  // server already recorded a pause, or after a successful resume). Lets the UI
  // hide the pause button — the server only allows one pause.
  pauseAlreadyUsed: boolean
  pause: () => Promise<void>
  resume: () => Promise<void>

  // Timer (only when mode.timer is set)
  timer: {
    remainingMs: number
    isRunningOut: boolean
    isCritical: boolean
  } | null
}

/**
 * Headless controller for the unified quiz session (exam + training).
 * Manages navigation, answers, flags, reveal, finish dialog, and optional timer.
 */
export function useQuizSession({
  questions,
  initialAnswers,
  initialFlags,
  initialPause,
  initialRevealed,
  mode,
  callbacks,
}: UseQuizSessionOptions): UseQuizSessionResult {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswersMap>(() => ({
    ...initialAnswers,
  }))
  const [flagged, setFlagged] = useState<Set<string>>(
    () => new Set(initialFlags ?? []),
  )
  const [revealed, setRevealed] = useState<Record<string, QuizRevealPayload>>(
    () => ({ ...(initialRevealed ?? {}) }),
  )
  const [pendingSelection, setPendingSelection] = useState<
    Record<string, string>
  >({})
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [isSubmitting, startTransition] = useTransition()

  // ---- Pause (rest break) ----
  const [isPaused, setIsPaused] = useState(initialPause?.isPaused ?? false)
  const [totalPauseDurationMs, setTotalPauseDurationMs] = useState(
    initialPause?.totalPauseDurationMs ?? 0,
  )
  // The single rest pause is "used" if the server already recorded pause time,
  // OR if we are currently mid-pause on reload (totalPauseDurationMs is still 0
  // until resume is credited, so we also check isPaused to avoid a flash of
  // the pause button while the overlay is showing).
  const [pauseAlreadyUsed, setPauseAlreadyUsed] = useState(
    () =>
      (initialPause?.isPaused ?? false) ||
      (initialPause?.totalPauseDurationMs ?? 0) > 0,
  )

  const totalQuestions = questions.length
  const currentQuestion = questions[currentIndex]
  const isImmediate = mode.feedback === "immediate"

  // ---- Navigation ----

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, totalQuestions - 1))
  }, [totalQuestions])

  const goPrevious = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }, [])

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalQuestions) {
        setCurrentIndex(index)
      }
    },
    [totalQuestions],
  )

  // ---- Flag ----

  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return
    const qid = currentQuestion._id
    setFlagged((prev) => {
      const next = new Set(prev)
      const newValue = !next.has(qid)
      if (newValue) {
        next.add(qid)
      } else {
        next.delete(qid)
      }
      // Fire-and-forget — errors are non-fatal for flagging
      void callbacks.onFlag(qid, newValue)
      return next
    })
  }, [currentQuestion, callbacks])

  // ---- Answer select ----

  const answerSelect = useCallback(
    async (optionIndex: number) => {
      if (!currentQuestion) return
      const qid = currentQuestion._id
      const selected = currentQuestion.options[optionIndex]
      if (!selected) return

      // Tuteur (feedback immédiat) = deux temps : sélectionner ne fait que
      // mettre un choix « en attente » localement. Rien n'est enregistré ni
      // révélé avant confirmAnswer(). Une fois révélée, la question est
      // verrouillée (on ne peut plus changer de réponse).
      if (isImmediate) {
        if (revealed[qid]) return
        setPendingSelection((p) => ({ ...p, [qid]: selected }))
        return
      }

      // Test / examen (feedback différé) : enregistrement immédiat, pas de
      // révélation par-question. Mise à jour optimiste + rollback si échec.
      const prev = answers[qid]
      setAnswers((a) => ({ ...a, [qid]: { ...a[qid], selected } }))

      const res = await callbacks.onAnswer(qid, selected)
      if (!res.ok) {
        setAnswers((a) => {
          const next = { ...a }
          if (prev === undefined) {
            delete next[qid]
          } else {
            next[qid] = prev
          }
          return next
        })
      }
    },
    [currentQuestion, answers, callbacks, isImmediate, revealed],
  )

  // ---- Confirm (mode tuteur uniquement) ----

  const confirmAnswer = useCallback(async () => {
    if (!currentQuestion) return
    const qid = currentQuestion._id
    if (revealed[qid]) return // déjà validée
    const selected = pendingSelection[qid]
    if (!selected) return

    const res = await callbacks.onAnswer(qid, selected)
    if (!res.ok) return // toast géré dans onAnswer ; on garde le pending pour réessai

    if (res.reveal) {
      const reveal = res.reveal
      setRevealed((r) => ({ ...r, [qid]: reveal }))
      setAnswers((a) => ({
        ...a,
        [qid]: { selected, isCorrect: selected === reveal.correctAnswer },
      }))
      setPendingSelection((p) => {
        const next = { ...p }
        delete next[qid]
        return next
      })
    }
  }, [currentQuestion, revealed, pendingSelection, callbacks])

  // ---- Pause / resume (rest break) ----

  const pause = useCallback(async () => {
    if (!callbacks.onPause || isPaused) return
    const res = await callbacks.onPause()
    if (res.ok) {
      setIsPaused(true)
    }
  }, [callbacks, isPaused])

  const resume = useCallback(async () => {
    if (!callbacks.onResume || !isPaused) return
    const res = await callbacks.onResume()
    if (res.ok) {
      setTotalPauseDurationMs((prev) => res.totalPauseDurationMs ?? prev)
      setIsPaused(false)
      // The single rest pause is now consumed — hide the pause control.
      setPauseAlreadyUsed(true)
    }
  }, [callbacks, isPaused])

  // ---- Finish ----

  const requestFinish = useCallback(() => {
    setFinishDialogOpen(true)
  }, [])

  const confirmFinish = useCallback(
    async (opts?: { isAutoSubmit?: boolean }) => {
      startTransition(async () => {
        const result = await callbacks.onFinish({
          isAutoSubmit: opts?.isAutoSubmit ?? false,
        })
        if (result.ok && result.redirectTo) {
          // Navigation happens outside hook; caller handles redirect
        }
      })
    },
    [callbacks],
  )

  // ---- Keyboard shortcuts ----

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      if (e.key === "ArrowRight") {
        goNext()
      } else if (e.key === "ArrowLeft") {
        goPrevious()
      } else if (e.key === "f" || e.key === "F") {
        toggleFlag()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [goNext, goPrevious, toggleFlag])

  // ---- Timer (composed, only when mode.timer) ----

  const onExpireRef = useRef<() => void>(() => {
    void confirmFinish({ isAutoSubmit: true })
  })
  // Keep ref in sync so confirmFinish closure is always fresh
  useEffect(() => {
    onExpireRef.current = () => {
      void confirmFinish({ isAutoSubmit: true })
    }
  }, [confirmFinish])

  const stableOnExpire = useCallback(() => {
    onExpireRef.current()
  }, [])

  // Timer hook — always called (hooks rules) but only ACTIF quand mode.timer
  // existe. Sans `enabled`, un mode sans chrono (entraînement) passe
  // totalSeconds=0 → remaining<=0 au montage → onExpire auto-soumettrait la
  // session instantanément (sessions « 0% / 0 réponse »).
  const timerConfig = mode.timer
  const timerResult = useExamTimer({
    enabled: !!timerConfig,
    serverStartTime: timerConfig?.serverStartTime ?? 0,
    totalSeconds: timerConfig?.totalSeconds ?? 0,
    isPaused,
    totalPauseDurationMs,
    onExpire: stableOnExpire,
  })

  const timer = timerConfig ? timerResult : null

  // ---- Derived counts ----

  const answeredCount = Object.keys(answers).length

  return {
    currentIndex,
    currentQuestion,
    goNext,
    goPrevious,
    goTo,
    answers,
    answeredCount,
    answerSelect,
    flagged,
    toggleFlag,
    revealed,
    pendingSelection,
    confirmAnswer,
    finishDialogOpen,
    isSubmitting,
    requestFinish,
    confirmFinish,
    setFinishDialogOpen,
    isPaused,
    pauseAlreadyUsed,
    pause,
    resume,
    timer,
  }
}
