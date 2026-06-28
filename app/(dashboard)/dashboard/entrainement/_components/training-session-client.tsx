"use client"

import { TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { QuizRunner } from "@/components/quiz/runner/quiz-runner"
import type {
  AnswersMap,
  QuizCallbacks,
  QuizMode,
  QuizQuestion,
} from "@/components/quiz/runner/types"
import { Button } from "@/components/ui/button"
import {
  completeTrainingSession,
  saveTrainingAnswer,
} from "@/features/training/actions"
import type { TrainingSessionView } from "@/features/training/dal"

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

  // Session expirée — garde avant de rendre le runner
  if (initialData.isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-900/20">
          <TriangleAlert className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h1 className="font-display mb-2 text-xl font-bold text-amber-900 dark:text-amber-100">
            Session expirée
          </h1>
          <p className="mb-6 text-amber-700 dark:text-amber-300">
            Cette session a expiré. Veuillez en créer une nouvelle.
          </p>
          <Button
            onClick={() => router.push("/dashboard/entrainement")}
            className="bg-amber-500 hover:bg-amber-600"
          >
            Retour à l&apos;entraînement
          </Button>
        </div>
      </div>
    )
  }

  // Mapper TrainingSessionQuestion[] → QuizQuestion[]
  const mappedQuestions: QuizQuestion[] = initialData.questions.map((q) => ({
    _id: q._id,
    question: q.question,
    options: q.options,
    domain: q.domain,
    objectifCMC: q.objectifCMC,
    images: q.images,
    // Champs révélés uniquement en tuteur pour les questions déjà répondues
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    references: q.references,
  }))

  // Mapper TrainingAnswerRecord → AnswersMap
  const initialAnswers: AnswersMap = {}
  for (const [qid, a] of Object.entries(initialData.answers)) {
    initialAnswers[qid] = {
      selected: a.selectedAnswer,
      isCorrect: a.isCorrect,
    }
  }

  // Mode : feedback immédiat en tuteur, différé en test
  const isTutor = initialData.session.mode === "tutor"

  const mode: QuizMode = {
    kind: "training",
    accent: "emerald",
    timer: null,
    pause: null,
    feedback: isTutor ? "immediate" : "deferred",
    showMeta: false,
    labels: { title: "Entraînement", finishCta: "Terminer" },
    backUrl: "/dashboard/entrainement",
  }

  const callbacks: QuizCallbacks = {
    onAnswer: async (questionId, selectedAnswer) => {
      const res = await saveTrainingAnswer({
        sessionId,
        questionId,
        selectedAnswer,
      })
      if (!res.success) {
        return { ok: false, error: res.error }
      }
      // En mode tuteur, renvoyer le reveal (correctAnswer + explanation + references)
      return {
        ok: true,
        reveal: res.reveal
          ? {
              correctAnswer: res.reveal.correctAnswer,
              explanation: res.reveal.explanation ?? "",
              references: res.reveal.references ?? [],
            }
          : undefined,
      }
    },
    // Flags d'entraînement restent locaux — no-op serveur
    onFlag: async () => {},
    onFinish: async () => {
      const res = await completeTrainingSession({ sessionId })
      if (!res.success) {
        toast.error("Erreur", { description: res.error })
        return { ok: false }
      }
      toast.success("Session terminée !", {
        description: "Vos résultats sont prêts",
      })
      const redirectTo = `/dashboard/entrainement/${sessionId}/results`
      router.push(redirectTo)
      return { ok: true, redirectTo }
    },
  }

  return (
    <QuizRunner
      questions={mappedQuestions}
      initialAnswers={initialAnswers}
      mode={mode}
      callbacks={callbacks}
    />
  )
}
