"use client"

import { ShieldAlert, TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  finalizeExam,
  pauseExam,
  resumeExam,
  saveExamAnswer,
  saveExamFlag,
  startExam,
} from "@/features/exams/actions"
import type {
  ExamAnswerForParticipation,
  ExamQuestionView,
  ExamSessionView,
} from "@/features/exams/dal"

interface EvaluationExam {
  title: string
  completionTime: number
  enablePause: boolean
  pauseDurationMinutes: number | null
}

interface EvaluationClientProps {
  examId: string
  exam: EvaluationExam
  questions: ExamQuestionView[]
  /** Participation existante (reprise / déjà soumise) ; null = pas encore démarrée. */
  initialSession: ExamSessionView
  /** Réponses déjà enregistrées (anti-triche : sans isCorrect). */
  initialAnswersRaw: ExamAnswerForParticipation[]
}

const isInProgress = (s: ExamSessionView): boolean =>
  s?.status === "in_progress" && s.startedAt != null

export function EvaluationClient({
  examId,
  exam,
  questions,
  initialSession,
  initialAnswersRaw,
}: EvaluationClientProps) {
  const router = useRouter()

  // serverStartTime: null = pas encore démarré, number = démarré
  const resuming = isInProgress(initialSession)
  const [serverStartTime, setServerStartTime] = useState<number | null>(
    resuming ? (initialSession?.startedAt ?? null) : null,
  )
  const [showWarningDialog, setShowWarningDialog] = useState(
    !initialSession || !isInProgress(initialSession),
  )

  const totalQuestions = questions.length
  const pauseDurationMinutes = exam.pauseDurationMinutes ?? 15

  // Mapper ExamQuestionView[] → QuizQuestion[] (sans champs sensibles — anti-triche)
  const mappedQuestions: QuizQuestion[] = questions.map((q) => ({
    _id: q._id,
    question: q.question,
    options: q.options,
    domain: q.domain,
    objectifCMC: q.objectifCMC,
    images: q.images,
    // NEVER include correctAnswer/explanation/references during exam (anti-cheat)
  }))

  // Mapper les réponses enregistrées → AnswersMap (sans isCorrect — anti-triche)
  const initialAnswers: AnswersMap = {}
  for (const row of initialAnswersRaw) {
    if (row.selectedAnswer !== null) {
      initialAnswers[row.questionId] = { selected: row.selectedAnswer }
      // NEVER include isCorrect (anti-cheat)
    }
  }

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
    accent: "blue",
    timer: serverStartTime
      ? { serverStartTime, totalSeconds: exam.completionTime }
      : null,
    pause: exam.enablePause ? "rest" : null,
    feedback: "deferred",
    showMeta: false,
    labels: { title: exam.title, finishCta: "Terminer l'examen" },
    backUrl: "/tableau-de-bord/examen-blanc",
  }

  // Callbacks
  const callbacks: QuizCallbacks = {
    onAnswer: async (questionId, selectedAnswer) => {
      const res = await saveExamAnswer({ examId, questionId, selectedAnswer })
      if (!res.success) {
        toast.error("Réponse non enregistrée, réessayez.")
        return {
          ok: false,
          error: res.error ?? "Erreur lors de l'enregistrement",
        }
      }
      // Anti-triche : ne JAMAIS renvoyer isCorrect ni reveal
      return { ok: true }
    },
    onFlag: async (questionId, isFlagged) => {
      const res = await saveExamFlag({ examId, questionId, isFlagged })
      return { ok: res.success }
    },
    onFinish: async ({ isAutoSubmit }) => {
      const result = await finalizeExam({ examId, isAutoSubmit })
      if (!result.success) {
        if (
          result.error.includes("déjà passé") ||
          result.error.includes("plus active")
        ) {
          router.push("/tableau-de-bord/examen-blanc")
        }
        toast.error(result.error)
        return { ok: false }
      }
      if (isAutoSubmit) {
        toast.success(
          "Temps écoulé ! Vos réponses ont été enregistrées automatiquement.",
        )
      } else {
        toast.success(
          "Examen terminé ! Vos réponses ont été enregistrées avec succès.",
        )
      }
      const redirectTo = `/tableau-de-bord/examen-blanc/${examId}/soumis`
      router.push(redirectTo)
      return { ok: true, redirectTo }
    },
    onPause: exam.enablePause
      ? async () => {
          const res = await pauseExam({ examId })
          if (res.success) {
            toast.info("⏸️ Pause - Prenez une pause bien méritée !", {
              duration: 5000,
            })
          } else {
            toast.error(res.error)
          }
          return { ok: res.success }
        }
      : undefined,
    onResume: exam.enablePause
      ? async () => {
          const res = await resumeExam({ examId })
          if (res.success) {
            toast.success("Pause terminée - Continuez l'examen !")
          } else {
            toast.error(res.error)
          }
          return {
            ok: res.success,
            totalPauseDurationMs: res.totalPauseDurationMs,
          }
        }
      : undefined,
  }

  // Démarrage de l'examen
  const handleStartExam = async () => {
    try {
      const result = await startExam({ examId })
      if (!result.success) {
        toast.error(result.error)
        router.push("/tableau-de-bord/examen-blanc")
        return
      }
      setServerStartTime(result.startedAt ?? null)
      setShowWarningDialog(false)
      toast.success("Examen démarré - Bonne chance !")
    } catch {
      toast.error("Erreur lors du démarrage de l'examen")
      router.push("/tableau-de-bord/examen-blanc")
    }
  }

  // Dialogue d'avertissement avant démarrage
  if (showWarningDialog) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent
            className="sm:max-w-2xl"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                Règles importantes de l&apos;examen
              </DialogTitle>
              <div className="space-y-4 pt-4 text-base">
                <div className="rounded-lg bg-linear-to-br from-red-50 to-orange-50 p-4 dark:from-red-950/30 dark:to-orange-950/30">
                  <h3 className="mb-3 font-semibold text-red-900 dark:text-red-200">
                    Mesures anti-fraude activées
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <span>
                        <strong>Session unique :</strong> Une seule tentative
                        autorisée — impossible de redémarrer l&apos;examen
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <span>
                        <strong>Chrono serveur :</strong> Le chronomètre
                        continue même si vous rafraîchissez ou fermez la page
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <span>
                        <strong>Soumission automatique :</strong> L&apos;examen
                        est soumis automatiquement quand le temps est écoulé
                      </span>
                    </li>
                    {exam.enablePause && (
                      <li className="flex items-start gap-2">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <span>
                          <strong>Pause repos disponible :</strong> Une pause
                          optionnelle de {pauseDurationMinutes} minutes (le
                          chrono se fige pendant la pause)
                        </span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                  <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
                    Informations sur l&apos;examen
                  </h3>
                  <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      • <strong>Questions :</strong> {totalQuestions}
                    </p>
                    <p>
                      • <strong>Durée :</strong>{" "}
                      {Math.floor(exam.completionTime / 60)} minutes
                    </p>
                    <p>
                      • <strong>Tentatives :</strong> 1 seule (impossible de
                      recommencer)
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/20">
                  <p className="text-center font-semibold text-amber-900 dark:text-amber-200">
                    ⚠️ En cliquant sur &quot;Commencer&quot;, vous acceptez ces
                    conditions et démarrez votre session d&apos;examen unique
                  </p>
                </div>
              </div>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/tableau-de-bord/examen-blanc")}
              >
                Annuler
              </Button>
              <Button
                onClick={handleStartExam}
                className="bg-linear-to-r from-green-600 to-emerald-600 font-semibold text-white hover:from-green-700 hover:to-emerald-700"
              >
                Je comprends - Commencer l&apos;examen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Examen en cours → QuizRunner
  return (
    <QuizRunner
      questions={mappedQuestions}
      initialAnswers={initialAnswers}
      initialFlags={initialFlags}
      initialPause={initialPause}
      pauseDurationMinutes={pauseDurationMinutes}
      mode={mode}
      callbacks={callbacks}
    />
  )
}
