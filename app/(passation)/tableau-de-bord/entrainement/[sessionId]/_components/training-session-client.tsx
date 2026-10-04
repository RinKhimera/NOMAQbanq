"use client"

import { Clock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { QuizRunner } from "@/components/quiz/runner/quiz-runner"
import type {
  AnswersMap,
  QuizCallbacks,
  QuizMode,
  QuizRevealPayload,
} from "@/components/quiz/runner/types"
import { StatusCard } from "@/components/shared/status-card"
import { Button } from "@/components/ui/button"
import { answerNotSavedMessage } from "@/features/attempts/answer-refusal"
import {
  completeTrainingSession,
  saveTrainingAnswer,
  setQuestionBookmark,
} from "@/features/training/actions"
import type { TrainingSessionView } from "@/features/training/dal"
import { callAction } from "@/lib/safe-action"

type SessionData = NonNullable<TrainingSessionView>

interface TrainingSessionClientProps {
  sessionId: string
  initialData: SessionData
}

export const TrainingSessionClient = ({
  sessionId,
  initialData,
}: TrainingSessionClientProps) => {
  const router = useRouter()

  // Série expirée — garde avant de rendre le runner
  if (initialData.isExpired) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 py-12">
        <StatusCard
          icon={Clock}
          iconTone="warning"
          label="Entraînement"
          title="Série expirée"
          description="Cette série a expiré : une série reste ouverte 24 heures. Composez-en une nouvelle."
          actions={
            <Button asChild className="max-md:h-11">
              <Link href="/tableau-de-bord/entrainement">
                Retour à l&apos;entraînement
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  const initialAnswers: AnswersMap = {}
  for (const [qid, a] of Object.entries(initialData.answers)) {
    initialAnswers[qid] = {
      selected: a.selectedAnswer,
      isCorrect: a.isCorrect,
    }
  }

  // Mode : feedback immédiat en tuteur, différé en test
  const isTutor = initialData.session.mode === "tutor"

  // En mode tuteur, hydrater les révélations des questions déjà répondues au
  // montage afin que la QuestionCard affiche correctAnswer + explication dès le
  // rechargement — ou la correction différée si la clé est retenue.
  const initialRevealed: Record<string, QuizRevealPayload> | undefined = isTutor
    ? Object.fromEntries(
        initialData.questions.flatMap((q): [string, QuizRevealPayload][] => {
          if (q.keyWithheld) return [[q._id, { keyWithheld: true }]]
          if (q.correctAnswer === undefined) return []
          return [
            [
              q._id,
              {
                correctAnswer: q.correctAnswer,
                explanation: q.explanation ?? "",
                references: q.references ?? [],
              },
            ],
          ]
        }),
      )
    : undefined

  const mode: QuizMode = {
    kind: "training",
    timer: null,
    pause: null,
    feedback: isTutor ? "immediate" : "deferred",
    showMeta: false,
    labels: {
      title: `Entraînement · ${initialData.session.domain ?? "Tous les domaines"}`,
    },
  }

  const callbacks: QuizCallbacks = {
    onAnswer: async (questionId, selectedAnswer) => {
      const res = await callAction(
        () => saveTrainingAnswer({ sessionId, questionId, selectedAnswer }),
        { retries: 1 }, // upsert idempotent — absorbe les micro-coupures
      )
      if (!res.success) {
        toast.error(answerNotSavedMessage(res))
        return { ok: false, error: res.error }
      }
      // En mode tuteur, renvoyer le reveal (correction, ou clé retenue)
      const reveal: QuizRevealPayload | undefined = !res.reveal
        ? undefined
        : "keyWithheld" in res.reveal
          ? { keyWithheld: true }
          : {
              correctAnswer: res.reveal.correctAnswer,
              explanation: res.reveal.explanation ?? "",
              references: res.reveal.references ?? [],
            }
      return { ok: true, reveal }
    },
    onFlag: async (questionId, isFlagged) => {
      const res = await callAction(
        () => setQuestionBookmark({ questionId, isBookmarked: isFlagged }),
        { retries: 1 }, // état voulu (pas une bascule) → reprise sans effet de bord
      )
      if (!res.success) {
        toast.error("Marquage non enregistré, réessayez.")
        return { ok: false }
      }
      return { ok: true }
    },
    onFinish: async () => {
      const res = await callAction(() => completeTrainingSession({ sessionId }))
      if (!res.success) {
        toast.error("Erreur", { description: res.error })
        return { ok: false }
      }
      toast.success("Série terminée !", {
        description: "Vos résultats sont prêts",
      })
      const redirectTo = `/tableau-de-bord/entrainement/${sessionId}/resultats`
      router.push(redirectTo)
      return { ok: true, redirectTo }
    },
  }

  return (
    <QuizRunner
      questions={initialData.questions}
      initialAnswers={initialAnswers}
      initialFlags={new Set(initialData.bookmarkedIds)}
      initialRevealed={initialRevealed}
      mode={mode}
      callbacks={callbacks}
    />
  )
}
