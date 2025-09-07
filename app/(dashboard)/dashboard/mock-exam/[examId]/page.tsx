"use client"

import { useMutation, useQuery } from "convex/react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Flag,
} from "lucide-react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

const ExamPage = () => {
  const params = useParams()
  const router = useRouter()
  const examId = params.examId as Id<"exams">

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const examWithQuestions = useQuery(api.exams.getExamWithQuestions, { examId })
  const submitAnswers = useMutation(api.exams.submitExamAnswers)

  // Soumission automatique quand le temps est écoulé
  const handleAutoSubmit = useCallback(async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const formattedAnswers = Object.entries(answers).map(
        ([questionId, selectedAnswer]) => ({
          questionId: questionId as Id<"questions">,
          selectedAnswer,
        }),
      )

      await submitAnswers({
        examId,
        answers: formattedAnswers,
      })

      toast.success(
        "Temps écoulé ! Vos réponses ont été enregistrées automatiquement.",
      )
      router.push("/dashboard/mock-exam")
    } catch {
      toast.error("Erreur lors de la soumission automatique")
    }
  }, [answers, examId, submitAnswers, router, isSubmitting])

  // Formatage du temps
  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // Timer effect
  useEffect(() => {
    if (!examWithQuestions) return

    // Initialiser le timer avec le temps de completion de l'examen
    if (timeRemaining === 0) {
      setTimeRemaining(examWithQuestions.completionTime * 1000)
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1000) {
          handleAutoSubmit()
          return 0
        }
        return prev - 1000
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [examWithQuestions, handleAutoSubmit, timeRemaining])

  // Gestion des réponses
  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  // Navigation
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < (examWithQuestions?.questions.length || 0)) {
      setCurrentQuestionIndex(index)
    }
  }

  // Soumission manuelle
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const formattedAnswers = Object.entries(answers).map(
        ([questionId, selectedAnswer]) => ({
          questionId: questionId as Id<"questions">,
          selectedAnswer,
        }),
      )

      await submitAnswers({
        examId,
        answers: formattedAnswers,
      })

      toast.success(
        "Examen terminé ! Vos réponses ont été enregistrées avec succès.",
      )
      router.push("/dashboard/mock-exam")
    } catch {
      toast.error("Erreur lors de la soumission")
    } finally {
      setIsSubmitting(false)
      setShowSubmitDialog(false)
    }
  }

  if (!examWithQuestions) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Chargement de l&apos;examen...
          </p>
        </div>
      </div>
    )
  }

  const currentQuestion = examWithQuestions.questions[currentQuestionIndex]
  const progress =
    ((currentQuestionIndex + 1) / examWithQuestions.questions.length) * 100
  const answeredCount = Object.keys(answers).length
  const isTimeRunningOut = timeRemaining < 10 * 60 * 1000 // moins de 10 minutes

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header fixe */}
      <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {examWithQuestions.title}
              </h1>
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                Question {currentQuestionIndex + 1} /{" "}
                {examWithQuestions.questions.length}
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                  isTimeRunningOut
                    ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                <Clock className="h-4 w-4" />
                <span className="font-mono font-medium">
                  {formatTime(timeRemaining)}
                </span>
              </div>

              <Button
                onClick={() => setShowSubmitDialog(true)}
                className="bg-green-600 text-white hover:bg-green-700"
                disabled={isSubmitting}
              >
                <Flag className="mr-2 h-4 w-4" />
                Terminer l&apos;examen
              </Button>
            </div>
          </div>

          {/* Barre de progression */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Progression</span>
              <span>
                {answeredCount} / {examWithQuestions.questions.length} répondues
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Sidebar navigation des questions */}
          <div className="lg:col-span-1">
            <Card className="sticky top-32">
              <CardHeader>
                <CardTitle className="text-lg">Navigation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {examWithQuestions.questions.map((_, index) => {
                    const questionAtIndex = examWithQuestions.questions[index]
                    const isAnswered = questionAtIndex
                      ? answers[questionAtIndex._id]
                      : false
                    const isCurrent = index === currentQuestionIndex

                    return (
                      <Button
                        key={index}
                        variant={isCurrent ? "default" : "outline"}
                        size="sm"
                        className={`relative ${
                          isAnswered
                            ? "border-green-300 bg-green-100 text-green-800 hover:bg-green-200 dark:border-green-600 dark:bg-green-900/30 dark:text-green-300"
                            : ""
                        } ${isCurrent ? "ring-2 ring-blue-500" : ""}`}
                        onClick={() => goToQuestion(index)}
                      >
                        {index + 1}
                        {isAnswered && (
                          <CheckCircle className="absolute -top-1 -right-1 h-3 w-3 text-green-600" />
                        )}
                      </Button>
                    )
                  })}
                </div>

                <div className="mt-6 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded border border-green-300 bg-green-100"></div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Répondue
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded border border-gray-300 bg-white dark:bg-gray-800"></div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Non répondue
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded bg-blue-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Question actuelle
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contenu principal - Question */}
          <div className="lg:col-span-3">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">
                  Question {currentQuestionIndex + 1}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Question */}
                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <p className="leading-relaxed text-gray-900 dark:text-white">
                    {currentQuestion?.question}
                  </p>
                </div>

                {/* Image si présente */}
                {currentQuestion?.imageSrc && (
                  <div className="flex justify-center">
                    <Image
                      src={currentQuestion.imageSrc}
                      alt="Question illustration"
                      className="h-auto max-w-full rounded-lg shadow-md"
                    />
                  </div>
                )}

                {/* Options de réponse */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Choisissez votre réponse :
                  </h3>

                  <RadioGroup
                    value={
                      currentQuestion ? answers[currentQuestion._id] || "" : ""
                    }
                    onValueChange={(value) =>
                      currentQuestion &&
                      handleAnswerChange(currentQuestion._id, value)
                    }
                  >
                    {currentQuestion?.options.map((option, index) => (
                      <div
                        key={index}
                        className="flex cursor-pointer items-start space-x-3 rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/10"
                        onClick={() =>
                          currentQuestion &&
                          handleAnswerChange(currentQuestion._id, option)
                        }
                      >
                        <RadioGroupItem
                          value={option}
                          id={`option-${index}`}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor={`option-${index}`}
                          className="flex-1 cursor-pointer leading-relaxed text-gray-700 dark:text-gray-300"
                        >
                          <span className="mr-2 font-medium text-blue-600 dark:text-blue-400">
                            {String.fromCharCode(65 + index)}.
                          </span>
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between border-t border-gray-200 pt-6 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={() => goToQuestion(currentQuestionIndex - 1)}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Précédent
                  </Button>

                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {answeredCount > 0 && (
                      <span>
                        {answeredCount} question{answeredCount > 1 ? "s" : ""}{" "}
                        répondue{answeredCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <Button
                    onClick={() => goToQuestion(currentQuestionIndex + 1)}
                    disabled={
                      currentQuestionIndex ===
                      examWithQuestions.questions.length - 1
                    }
                    className="flex items-center gap-2"
                  >
                    Suivant
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog de confirmation de soumission */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Terminer l&apos;examen
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>Êtes-vous sûr de vouloir terminer l&apos;examen ?</p>

              <div className="space-y-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <div className="flex justify-between text-sm">
                  <span>Questions répondues :</span>
                  <span className="font-medium">
                    {answeredCount} / {examWithQuestions.questions.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Questions non répondues :</span>
                  <span className="font-medium text-amber-600">
                    {examWithQuestions.questions.length - answeredCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Temps restant :</span>
                  <span className="font-medium">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>

              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Une fois soumis, vous ne pourrez plus modifier vos réponses. Vos
                résultats seront disponibles une fois que tous les candidats
                auront terminé l&apos;examen.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              disabled={isSubmitting}
            >
              Continuer l&apos;examen
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "Soumission..." : "Terminer l'examen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ExamPage
