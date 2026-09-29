"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { ExamConsignes } from "@/app/(dashboard)/tableau-de-bord/examen-blanc/_components/exam-consignes"
import { QuizRunner } from "@/components/quiz/runner/quiz-runner"
import type {
  AnswersMap,
  QuizCallbacks,
  QuizMode,
  QuizQuestion,
} from "@/components/quiz/runner/types"
import { PassationSkeleton } from "@/components/quiz/session/passation-skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { answerNotSavedMessage } from "@/features/attempts/answer-refusal"
import {
  finalizeExam,
  pauseExam,
  readServerClock,
  resumeExam,
  saveExamAnswer,
  saveExamFlag,
  startExam,
} from "@/features/exams/actions"
import type {
  ExamAnswerForParticipation,
  ExamSessionView,
} from "@/features/exams/dal"
import { DEFAULT_PAUSE_MINUTES } from "@/features/exams/schemas"
import { closesBeforeBudget } from "@/lib/exam-list"
import { formatCountdown, formatShortDuration } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { TONE_SOFT } from "@/lib/tone"

const LIST_HREF = "/tableau-de-bord/examen-blanc"
const RESUME_NOTICE_MS = 8000

interface EvaluationExam {
  title: string
  questionCount: number
  completionTime: number
  enablePause: boolean
  pauseDurationMinutes: number | null
  endDate: number
}

interface EvaluationClientProps {
  examId: string
  exam: EvaluationExam
  questions: QuizQuestion[]
  /** Participation existante (reprise / déjà soumise) ; null = pas encore démarrée. */
  initialSession: ExamSessionView
  /** Réponses déjà enregistrées (anti-triche : sans isCorrect). */
  initialAnswersRaw: ExamAnswerForParticipation[]
  /** Horloge serveur du rendu — ancre le premier affichage du chrono. */
  initialNow: number
}

const isInProgress = (s: ExamSessionView): boolean =>
  s?.status === "in_progress" && s.startedAt != null

/**
 * Consignes avant le départ, quand la page est ouverte sans participation
 * (lien direct, retour arrière). Le départ depuis la liste passe par le
 * dialogue des consignes ; ici, c'est le même texte en plein écran.
 */
const StartScreen = ({
  exam,
  now,
  isStarting,
  onStart,
}: {
  exam: EvaluationExam
  now: number
  isStarting: boolean
  onStart: () => void
}) => {
  const [ack, setAck] = useState(false)
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <section className="bg-surface border-line shadow-1 flex w-full max-w-160 flex-col gap-5 rounded-lg border p-7 max-[480px]:px-5">
        <div className="flex flex-col gap-2">
          <p className="type-label">Examen blanc</p>
          <h1 className="type-h2 text-ink">Commencer {exam.title} ?</h1>
          <p className="text-ink-3 text-[15px]">
            Prévoyez un moment sans interruption.
          </p>
        </div>
        {closesBeforeBudget(exam, now) && (
          <Alert className={TONE_SOFT.warning}>
            <AlertDescription className="text-warning-ink">
              Cet examen ferme dans {formatCountdown(exam.endDate - now)}, avant
              la fin des {formatShortDuration(exam.completionTime * 1000)}{" "}
              prévues : il sera soumis à la fermeture.
            </AlertDescription>
          </Alert>
        )}
        <ExamConsignes
          questionCount={exam.questionCount}
          completionTime={exam.completionTime}
          pauseDurationMinutes={
            exam.enablePause ? exam.pauseDurationMinutes : null
          }
          endDate={exam.endDate}
        />
        <label className="text-ink flex cursor-pointer items-center gap-2.5 text-sm max-md:min-h-11">
          <Checkbox
            checked={ack}
            onCheckedChange={(v) => setAck(v === true)}
            disabled={isStarting}
            data-testid="exam-consignes-ack"
          />
          J&apos;ai lu les consignes.
        </label>
        <div className="flex flex-wrap justify-end gap-2 max-md:*:flex-1">
          <Button asChild variant="ghost" className="max-md:h-11">
            <Link href={LIST_HREF}>Annuler</Link>
          </Button>
          <Button
            type="button"
            onClick={onStart}
            disabled={!ack || isStarting}
            data-testid="btn-start-exam"
            className="max-md:h-11"
          >
            {isStarting && <Spinner size="sm" />}
            Commencer l&apos;examen
          </Button>
        </div>
      </section>
    </div>
  )
}

export function EvaluationClient({
  examId,
  exam,
  questions,
  initialSession,
  initialAnswersRaw,
  initialNow,
}: EvaluationClientProps) {
  const router = useRouter()
  const [isStarting, startTransition] = useTransition()

  // serverStartTime: null = pas encore démarré, number = démarré
  const resuming = isInProgress(initialSession)
  const [serverStartTime, setServerStartTime] = useState<number | null>(
    resuming ? (initialSession?.startedAt ?? null) : null,
  )
  const [showStart, setShowStart] = useState(!resuming)

  // Reprise : l'alerte s'efface d'elle-même une fois lue.
  const [showResumed, setShowResumed] = useState(resuming)
  useEffect(() => {
    if (!showResumed) return
    const id = setTimeout(() => setShowResumed(false), RESUME_NOTICE_MS)
    return () => clearTimeout(id)
  }, [showResumed])

  const totalQuestions = questions.length
  const pauseDurationMinutes =
    exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES

  // Mapper les réponses enregistrées → AnswersMap (sans isCorrect — anti-triche)
  const initialAnswers: AnswersMap = {}
  for (const row of initialAnswersRaw) {
    if (row.selectedAnswer !== null) {
      initialAnswers[row.questionId] = { selected: row.selectedAnswer }
      // NEVER include isCorrect (anti-cheat)
    }
  }
  const answeredCount = Object.keys(initialAnswers).length

  // Flags persistés côté serveur
  const initialFlags = new Set(
    initialAnswersRaw.filter((r) => r.isFlagged).map((r) => r.questionId),
  )

  // État de pause initial (réhydraté si reprise en pause)
  const initialPause =
    resuming && initialSession
      ? {
          isPaused: initialSession.isPaused,
          totalPauseDurationMs: initialSession.totalPauseDurationMs ?? 0,
          // Timestamp serveur de début de pause (epoch ms) pour réhydrater le
          // décompte overlay après un rechargement sans repartir de Date.now().
          pauseStartedAtMs: initialSession.pauseStartedAt ?? undefined,
        }
      : undefined

  // Mode
  const mode: QuizMode = {
    kind: "exam",
    timer: serverStartTime
      ? { serverStartTime, totalSeconds: exam.completionTime, initialNow }
      : null,
    pause: exam.enablePause ? "rest" : null,
    feedback: "deferred",
    showMeta: false,
    labels: { title: exam.title },
  }

  // Callbacks
  const callbacks: QuizCallbacks = {
    onAnswer: async (questionId, selectedAnswer) => {
      const res = await callAction(
        () => saveExamAnswer({ examId, questionId, selectedAnswer }),
        { retries: 1 }, // upsert idempotent — absorbe les micro-coupures
      )
      if (!res.success) {
        const error = res.error ?? "Erreur lors de l'enregistrement"
        // Budget épuisé côté serveur (chrono client en retard) : réessayer ne
        // sert à rien, le moteur soumet l'examen.
        if ("code" in res && res.code === "TIME_UP") {
          toast.error("Temps écoulé : cette réponse n'a pas été enregistrée.")
          return { ok: false, error, timeUp: true }
        }
        toast.error(answerNotSavedMessage(res))
        return { ok: false, error }
      }
      // Anti-triche : ne JAMAIS renvoyer isCorrect ni reveal
      return { ok: true, serverNow: res.serverNow }
    },
    onFlag: async (questionId, isFlagged) => {
      const res = await callAction(
        () => saveExamFlag({ examId, questionId, isFlagged }),
        { retries: 1 },
      )
      return { ok: res.success }
    },
    onFinish: async ({ isAutoSubmit }) => {
      const result = await callAction(() =>
        finalizeExam({ examId, isAutoSubmit }),
      )
      if (!result.success) {
        const error = result.error ?? "Erreur lors de la soumission"
        if (error.includes("déjà passé") || error.includes("plus active")) {
          router.push(LIST_HREF)
        }
        toast.error(error)
        return { ok: false }
      }
      if (isAutoSubmit) {
        toast.success(
          "Temps écoulé ! Vos réponses ont été enregistrées automatiquement.",
        )
      } else {
        toast.success("Examen soumis. Vos réponses sont enregistrées.")
      }
      const redirectTo = `/tableau-de-bord/examen-blanc/${examId}/soumis`
      router.push(redirectTo)
      return { ok: true, redirectTo }
    },
    onPause: exam.enablePause
      ? async () => {
          const res = await callAction(() => pauseExam({ examId }))
          if (!res.success) {
            toast.error(res.error ?? "Erreur lors de la mise en pause")
            return { ok: false }
          }
          return {
            ok: true,
            pauseStartedAt: res.pauseStartedAt,
            serverNow: res.serverNow,
          }
        }
      : undefined,
    onResume: exam.enablePause
      ? async () => {
          const res = await callAction(() => resumeExam({ examId }))
          if (res.success) {
            return {
              ok: true,
              totalPauseDurationMs: res.totalPauseDurationMs,
              serverNow: res.serverNow,
            }
          }
          toast.error(res.error ?? "Erreur lors de la reprise")
          return { ok: false }
        }
      : undefined,
    // Silencieux : lecture de fond au réveil de l'onglet, rien à annoncer.
    onSyncClock: async () => {
      const res = await callAction(() => readServerClock(), { retries: 1 })
      return res.success
        ? { ok: true, serverNow: res.serverNow }
        : { ok: false }
    },
  }

  // Démarrage de l'examen. La page ne met les questions dans le payload RSC
  // qu'en in_progress : on ne quitte l'écran de consignes (bouton en attente
  // entre temps) qu'une fois le router.refresh() appliqué, dans la même
  // transition, pour ne jamais monter le runner à vide avec le chrono lancé.
  const handleStartExam = () => {
    startTransition(async () => {
      const result = await callAction(() => startExam({ examId }))
      if (!result.success) {
        toast.error(result.error)
        router.push(LIST_HREF)
        return
      }
      setServerStartTime(result.startedAt ?? null)
      router.refresh()
      setShowStart(false)
    })
  }

  if (showStart) {
    return (
      <StartScreen
        exam={exam}
        now={initialNow}
        isStarting={isStarting}
        onStart={handleStartExam}
      />
    )
  }

  // Fenêtre transitoire entre startExam et l'arrivée des questions via refresh :
  // ne jamais monter le runner à vide (chrono lancé sur un examen sans question).
  if (totalQuestions === 0) {
    return <PassationSkeleton label="Préparation de l'examen" />
  }

  return (
    <QuizRunner
      questions={questions}
      initialAnswers={initialAnswers}
      initialFlags={initialFlags}
      initialPause={initialPause}
      pauseDurationMinutes={pauseDurationMinutes}
      mode={mode}
      callbacks={callbacks}
      banners={
        showResumed && (
          <Alert
            data-testid="resume-alert"
            className={`${TONE_SOFT.info} [&>svg]:text-accent-ink`}
          >
            <AlertTitle>Reprise de l&apos;examen</AlertTitle>
            <AlertDescription>
              Vos {answeredCount} réponse{answeredCount > 1 ? "s" : ""} et vos
              marquages sont conservés. Le chronomètre a continué pendant votre
              absence.
            </AlertDescription>
          </Alert>
        )
      }
    />
  )
}
