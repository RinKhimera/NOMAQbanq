"use client"

import { useQuery } from "convex/react"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Eye,
  Home,
  RefreshCw,
  Target,
  X,
  XCircle,
} from "lucide-react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { Doc } from "@/convex/_generated/dataModel"

export default function TrainingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const domain = searchParams.get("domain") || "all"
  const count = parseInt(searchParams.get("count") || "10")

  const [questions, setQuestions] = useState<Doc<"questions">[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState("")
  const [showFeedback, setShowFeedback] = useState(false)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(
    new Set(),
  )
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    explanation: true,
    objective: false,
    references: false,
  })

  const randomQuestions = useQuery(
    api.questions.getRandomLearningBankQuestions,
    {
      count,
      domain: domain === "all" ? undefined : domain,
    },
  )

  // Charger les questions une seule fois
  useEffect(() => {
    if (
      randomQuestions &&
      randomQuestions.length > 0 &&
      questions.length === 0
    ) {
      setQuestions(randomQuestions)
    }
  }, [randomQuestions, questions.length])

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  const handleAnswerSubmit = () => {
    if (!userAnswer || !currentQuestion) return

    const isCorrect = userAnswer === currentQuestion.correctAnswer
    if (isCorrect) {
      setCorrectAnswers((prev) => prev + 1)
    }

    setAnsweredQuestions((prev) => new Set([...prev, currentQuestionIndex]))
    setShowFeedback(true)
  }

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      setShowCompleteDialog(true)
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
      setUserAnswer("")
      setShowFeedback(false)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      setUserAnswer("")
      setShowFeedback(false)
    }
  }

  const handleExit = () => {
    router.push("/dashboard/learning")
  }

  const handleRestart = () => {
    window.location.reload()
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Chargement des questions d&apos;entraînement...
          </p>
        </div>
      </div>
    )
  }

  const isCorrect = userAnswer === currentQuestion?.correctAnswer
  const scorePercentage =
    questions.length > 0
      ? Math.round((correctAnswers / questions.length) * 100)
      : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Entraînement
              </h1>
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 dark:bg-blue-900/30"
              >
                Question {currentQuestionIndex + 1} / {questions.length}
              </Badge>
              {domain !== "all" && (
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30">
                  {domain}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Score: {correctAnswers}/{answeredQuestions.size}
              </div>
              <Button
                variant="outline"
                onClick={() => setShowExitDialog(true)}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Quitter
              </Button>
            </div>
          </div>

          {/* Barre de progression */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Progression</span>
              <span>
                {answeredQuestions.size} / {questions.length} répondues
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Question */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">
                Question {currentQuestionIndex + 1}
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{currentQuestion?.domain}</Badge>
                <Badge variant="secondary" className="max-w-[200px] truncate">
                  {currentQuestion?.objectifCMC}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Question */}
            <div>
              <p className="text-lg leading-relaxed text-gray-900 dark:text-white">
                {currentQuestion?.question}
              </p>
            </div>

            {/* Image si présente */}
            {currentQuestion?.imageSrc && (
              <div className="flex justify-center">
                <Image
                  src={currentQuestion.imageSrc}
                  alt="Question illustration"
                  width={500}
                  height={300}
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
                value={userAnswer}
                onValueChange={setUserAnswer}
                disabled={showFeedback}
                className="space-y-3"
              >
                {currentQuestion?.options.map((option, index) => {
                  let optionClass =
                    "flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-colors "

                  if (showFeedback) {
                    if (option === currentQuestion.correctAnswer) {
                      optionClass +=
                        "border-green-500 bg-green-50 dark:bg-green-900/20"
                    } else if (
                      option === userAnswer &&
                      option !== currentQuestion.correctAnswer
                    ) {
                      optionClass +=
                        "border-red-500 bg-red-50 dark:bg-red-900/20"
                    } else {
                      optionClass +=
                        "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                    }
                  } else {
                    optionClass +=
                      "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/10"
                  }

                  return (
                    <div key={index} className={optionClass}>
                      <RadioGroupItem
                        value={option}
                        id={`option-${index}`}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`option-${index}`}
                        className="flex-1 cursor-pointer leading-relaxed"
                      >
                        <span className="mr-2 font-medium text-blue-600 dark:text-blue-400">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        {option}
                      </Label>
                      {showFeedback &&
                        option === currentQuestion.correctAnswer && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                      {showFeedback &&
                        option === userAnswer &&
                        option !== currentQuestion.correctAnswer && (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                    </div>
                  )
                })}
              </RadioGroup>
            </div>

            {/* Bouton de validation */}
            {!showFeedback && (
              <div className="flex justify-center">
                <Button
                  onClick={handleAnswerSubmit}
                  disabled={!userAnswer}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Valider ma réponse
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feedback */}
        {showFeedback && (
          <Card
            className={`mb-6 border-l-4 ${isCorrect ? "border-l-green-500 bg-green-50/30" : "border-l-red-500 bg-red-50/30"} dark:bg-gray-900/50`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    isCorrect
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-red-100 dark:bg-red-900/30"
                  }`}
                >
                  {isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <CardTitle
                  className={`text-xl ${isCorrect ? "text-green-700" : "text-red-700"} dark:text-white`}
                >
                  {isCorrect ? "Bonne réponse !" : "Réponse incorrecte"}
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {!isCorrect && (
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                  <p className="text-blue-900 dark:text-blue-100">
                    <strong>Bonne réponse :</strong>{" "}
                    {currentQuestion?.correctAnswer}
                  </p>
                </div>
              )}

              {/* Sections collapsibles */}
              <div className="space-y-3">
                {/* Explication */}
                <Collapsible
                  open={expandedSections.explanation}
                  onOpenChange={() => toggleSection("explanation")}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Explication
                      </div>
                      {expandedSections.explanation ? "−" : "+"}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                      <p className="whitespace-pre-line text-blue-900 dark:text-blue-100">
                        {currentQuestion?.explanation}
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Objectif CMC */}
                <Collapsible
                  open={expandedSections.objective}
                  onOpenChange={() => toggleSection("objective")}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Objectif CMC
                      </div>
                      {expandedSections.objective ? "−" : "+"}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
                      <p className="whitespace-pre-line text-purple-900 dark:text-purple-100">
                        {currentQuestion?.objectifCMC}
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Références */}
                {currentQuestion?.references &&
                  currentQuestion.references.length > 0 && (
                    <Collapsible
                      open={expandedSections.references}
                      onOpenChange={() => toggleSection("references")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Références ({currentQuestion.references.length})
                          </div>
                          {expandedSections.references ? "−" : "+"}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                          <div className="space-y-2">
                            {currentQuestion.references.map(
                              (reference, index) => (
                                <div
                                  key={index}
                                  className="border-l-2 border-gray-300 pl-3 dark:border-gray-600"
                                >
                                  <span className="mr-2 font-semibold text-blue-600">
                                    {index + 1}.
                                  </span>
                                  <span className="whitespace-pre-line text-gray-700 dark:text-gray-300">
                                    {reference}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between border-t pt-4">
                <Button
                  variant="outline"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Précédent
                </Button>

                <div className="text-sm text-gray-500">
                  {answeredQuestions.size > 0 && (
                    <span>
                      Score actuel:{" "}
                      {Math.round(
                        (correctAnswers / answeredQuestions.size) * 100,
                      )}
                      %
                    </span>
                  )}
                </div>

                <Button
                  onClick={handleNextQuestion}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {isLastQuestion ? "Terminer" : "Suivant"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de sortie */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitter l&apos;entraînement ?</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir quitter votre session d&apos;entraînement
              ? Votre progression ne sera pas sauvegardée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Continuer
            </Button>
            <Button
              onClick={handleExit}
              className="bg-red-600 hover:bg-red-700"
            >
              Quitter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de fin */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Entraînement terminé !
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-2">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {scorePercentage}%
                </div>
                <p className="text-gray-600">
                  {correctAnswers} / {questions.length} bonnes réponses
                </p>
              </div>

              <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Félicitations ! Vous avez terminé votre session
                  d&apos;entraînement.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleRestart}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Recommencer
            </Button>
            <Button onClick={handleExit} className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Retour à l&apos;accueil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
