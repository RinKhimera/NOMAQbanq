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
    {},
  )
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [isSubmitting, startTransition] = useTransition()

  // ---- Pause (rest break) ----
  const [isPaused, setIsPaused] = useState(initialPause?.isPaused ?? false)
  const [totalPauseDurationMs, setTotalPauseDurationMs] = useState(
    initialPause?.totalPauseDurationMs ?? 0,
  )
  // The single rest pause is "used" if the server already recorded pause time,
  // or once we successfully resume from a pause taken this session.
  const [pauseAlreadyUsed, setPauseAlreadyUsed] = useState(
    (initialPause?.totalPauseDurationMs ?? 0) > 0,
  )

  const totalQuestions = questions.length
  const currentQuestion = questions[currentIndex]

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

      const res = await callbacks.onAnswer(qid, selected)
      if (!res.ok) return

      setAnswers((prev) => {
        const existing = prev[qid]
        const next: AnswersMap = {
          ...prev,
          [qid]: { ...existing, selected },
        }
        return next
      })

      if (res.reveal && mode.feedback === "immediate") {
        const reveal = res.reveal
        setRevealed((prev) => ({ ...prev, [qid]: reveal }))
        // Store isCorrect derived from reveal
        setAnswers((prev) => ({
          ...prev,
          [qid]: {
            selected,
            isCorrect:
              prev[qid]?.selected === reveal.correctAnswer ||
              selected === reveal.correctAnswer,
          },
        }))
      }
    },
    [currentQuestion, callbacks, mode.feedback],
  )

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

  // Timer hook — always called (hooks rules) but only used when mode.timer exists
  const timerConfig = mode.timer
  const timerResult = useExamTimer({
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
