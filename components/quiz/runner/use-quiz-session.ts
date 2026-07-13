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
  // Résolvent `true` en succès seulement — l'UI (timestamps locaux de
  // l'overlay) ne doit pas avancer sur une pause/reprise qui a échoué.
  pause: () => Promise<boolean>
  resume: () => Promise<boolean>

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
  // Un seul onAnswer en vol par question ; le clic le plus récent pendant un
  // envoi remplace le précédent (coalescing) et part quand l'envoi se règle.
  // Un éventuel retry côté callback vit DANS ce créneau → l'ordre des clics
  // est préservé, un clic périmé ne peut pas écraser un clic plus récent.
  const answerSends = useRef<
    Record<string, { inFlight: boolean; queued?: string }>
  >({})
  // Dernière valeur CONFIRMÉE par le serveur — cible du rollback (jamais
  // « l'état d'avant-clic », qu'un clic intermédiaire a pu rendre périmé).
  const persistedAnswers = useRef<Record<string, string | undefined>>(
    Object.fromEntries(
      Object.entries(initialAnswers).map(([qid, a]) => [qid, a.selected]),
    ),
  )
  // Flags : même mécanique que les réponses. Le miroir ref évite la closure
  // périmée (le raccourci clavier « f » peut invoquer deux fois la même
  // closure) ; l'envoi sérialisé + rollback vers la valeur confirmée évite
  // les reverts non composables (deux échecs qui laissent l'inverse).
  const flaggedRef = useRef<Set<string>>(new Set(initialFlags ?? []))
  const flagSends = useRef<
    Record<string, { inFlight: boolean; queued?: boolean }>
  >({})
  const persistedFlags = useRef<Set<string>>(new Set(initialFlags ?? []))
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

  const setFlagLocal = useCallback((qid: string, value: boolean) => {
    if (value) {
      flaggedRef.current.add(qid)
    } else {
      flaggedRef.current.delete(qid)
    }
    setFlagged(new Set(flaggedRef.current))
  }, [])

  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return
    const qid = currentQuestion._id
    const newValue = !flaggedRef.current.has(qid)
    setFlagLocal(qid, newValue)

    const state = (flagSends.current[qid] ??= { inFlight: false })
    if (state.inFlight) {
      state.queued = newValue
      return
    }
    state.inFlight = true
    // Envoi sérialisé (un seul onFlag en vol par question, coalescing du
    // dernier état voulu). Silencieux : cosmétique, pas de bruit en passation.
    void (async () => {
      let current = newValue
      for (;;) {
        let ok: boolean
        try {
          ok = (await callbacks.onFlag(qid, current)).ok
        } catch {
          ok = false
        }
        if (ok) {
          if (current) {
            persistedFlags.current.add(qid)
          } else {
            persistedFlags.current.delete(qid)
          }
        }
        const queued = state.queued
        state.queued = undefined
        if (queued !== undefined) {
          current = queued
          continue
        }
        state.inFlight = false
        if (!ok) {
          setFlagLocal(qid, persistedFlags.current.has(qid))
        }
        return
      }
    })()
  }, [currentQuestion, callbacks, setFlagLocal])

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
      // révélation par-question. Optimiste + envoi sérialisé par question.
      setAnswers((a) => ({ ...a, [qid]: { ...a[qid], selected } }))

      const state = (answerSends.current[qid] ??= { inFlight: false })
      if (state.inFlight) {
        state.queued = selected
        return
      }
      state.inFlight = true
      let current = selected
      for (;;) {
        let res: Awaited<ReturnType<QuizCallbacks["onAnswer"]>>
        try {
          res = await callbacks.onAnswer(qid, current)
        } catch {
          res = { ok: false, error: "Erreur réseau" }
        }
        // Enregistrer le succès AVANT le test de coalescing : un envoi
        // supersédé qui a réussi est bien persisté côté serveur — c'est la
        // cible du rollback si l'envoi suivant échoue.
        if (res.ok) {
          persistedAnswers.current[qid] = current
        }
        const queued = state.queued
        state.queued = undefined
        if (queued !== undefined) {
          // Supersédé par un clic plus récent : ni rollback ni fin de boucle —
          // on envoie le dernier choix.
          current = queued
          continue
        }
        state.inFlight = false
        if (!res.ok) {
          const persisted = persistedAnswers.current[qid]
          setAnswers((a) => {
            const next = { ...a }
            if (persisted === undefined) {
              delete next[qid]
            } else {
              next[qid] = { ...next[qid], selected: persisted }
            }
            return next
          })
        }
        return
      }
    },
    [currentQuestion, callbacks, isImmediate, revealed],
  )

  // ---- Confirm (mode tuteur uniquement) ----

  const confirmAnswer = useCallback(async () => {
    if (!currentQuestion) return
    const qid = currentQuestion._id
    if (revealed[qid]) return // déjà validée
    const selected = pendingSelection[qid]
    if (!selected) return

    let res: Awaited<ReturnType<QuizCallbacks["onAnswer"]>>
    try {
      res = await callbacks.onAnswer(qid, selected)
    } catch {
      return // rejet réseau : pending conservé pour réessai, pas de reveal
    }
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
    if (!callbacks.onPause || isPaused) return false
    try {
      const res = await callbacks.onPause()
      if (res.ok) {
        setIsPaused(true)
      }
      return res.ok
    } catch {
      // rejet réseau : rester non-pausé, le callback de page a déjà toasté
      return false
    }
  }, [callbacks, isPaused])

  const resume = useCallback(async () => {
    if (!callbacks.onResume || !isPaused) return false
    try {
      const res = await callbacks.onResume()
      if (res.ok) {
        setTotalPauseDurationMs((prev) => res.totalPauseDurationMs ?? prev)
        setIsPaused(false)
        // The single rest pause is now consumed — hide the pause control.
        setPauseAlreadyUsed(true)
      }
      return res.ok
    } catch {
      // rejet réseau : rester en pause, retentable via le bouton
      return false
    }
  }, [callbacks, isPaused])

  // ---- Finish ----

  const requestFinish = useCallback(() => {
    setFinishDialogOpen(true)
  }, [])

  const confirmFinish = useCallback(
    async (opts?: { isAutoSubmit?: boolean }) => {
      startTransition(async () => {
        try {
          const result = await callbacks.onFinish({
            isAutoSubmit: opts?.isAutoSubmit ?? false,
          })
          if (result.ok && result.redirectTo) {
            // Navigation happens outside hook; caller handles redirect
          }
        } catch {
          // rejet réseau : le dialog reste ouvert, retentable
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
