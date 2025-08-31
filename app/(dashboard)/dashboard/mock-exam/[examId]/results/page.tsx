"use client"

import { useQuery } from "convex/react"
import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  List,
  Trophy,
  XCircle,
} from "lucide-react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

const ResultsPage = () => {
  const params = useParams()
  const router = useRouter()
  const examId = params.examId as Id<"exams">

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set(),
  )
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Queries
  const examWithQuestions = useQuery(api.exams.getExamWithQuestions, { examId })
  const currentUser = useQuery(api.users.getCurrentUser)

  // Gérer l'affichage du bouton scroll to top
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Toggle question expansion
  const toggleQuestionExpansion = (index: number) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedQuestions(newExpanded)
  }

  // Scroll to specific question
  const scrollToQuestion = (index: number) => {
    setCurrentQuestionIndex(index)
    const element = document.getElementById(`question-${index}`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  if (!examWithQuestions || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Chargement des résultats...
          </p>
        </div>
      </div>
    )
  }

  // Trouver les résultats de l'utilisateur
  const userResult = examWithQuestions.participants.find(
    (p) => p.userId === currentUser._id,
  )

  if (!userResult) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <XCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
            Résultats non trouvés
          </h2>
          <p className="mb-4 text-gray-600 dark:text-gray-400">
            Aucun résultat trouvé pour cet examen.
          </p>
          <Button onClick={() => router.push("/dashboard/mock-exam")}>
            Retour aux examens
          </Button>
        </div>
      </div>
    )
  }

  const totalQuestions = examWithQuestions.questions.length
  const correctAnswers = userResult.answers.filter((a) => a.isCorrect).length
  const scorePercentage = userResult.score

  // Déterminer la couleur du score
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400"
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400"
    return "text-red-600 dark:text-red-400"
  }

  return (
    <div className="@container flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header avec score */}
      <div id="results-header">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex w-full items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-blue-600">
                  Résultats de l&apos;examen
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {examWithQuestions.title}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/mock-exam")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour aux examens
              </Button>
            </div>
          </div>

          {/* Score principal */}
          <div className="mt-6 rounded-2xl border border-gray-200 p-6 dark:border-gray-700">
            <div className="flex flex-col items-center justify-between gap-2 @xl:flex-row">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg dark:bg-gray-800`}
                >
                  <Trophy
                    className={`h-8 w-8 ${getScoreColor(scorePercentage)}`}
                  />
                </div>
                <div>
                  <h2
                    className={`text-4xl font-bold ${getScoreColor(scorePercentage)}`}
                  >
                    {scorePercentage}%
                  </h2>
                  <p className="text-lg text-gray-700 dark:text-gray-300">
                    {correctAnswers} / {totalQuestions} bonnes réponses
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Complété le{" "}
                  {new Date(userResult.completedAt).toLocaleDateString(
                    "fr-FR",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
                <Progress value={scorePercentage} className="mt-2 w-48" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 gap-4 @[45rem]:grid-cols-4">
          {/* Sidebar navigation */}
          <div className="@[45rem]:col-span-1">
            <Card className="sticky top-8 h-fit max-h-[calc(100vh-4rem)] gap-2">
              <CardHeader>
                <CardTitle className="text-lg">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="max-h-96 overflow-auto">
                  <div className="flex flex-wrap gap-2 pr-4">
                    {examWithQuestions.questions.map((_, index) => {
                      const userAnswer = userResult.answers.find(
                        (a) =>
                          a.questionId ===
                          examWithQuestions.questions[index]?._id,
                      )
                      const isCorrect = userAnswer?.isCorrect ?? false
                      const isCurrent = index === currentQuestionIndex

                      return (
                        <Button
                          key={index}
                          variant={isCurrent ? "default" : "outline"}
                          size="icon"
                          className={cn(
                            "relative overflow-hidden",
                            isCorrect && [
                              "border-green-300 bg-green-100 text-green-800",
                              "hover:bg-green-200",
                              "dark:border-green-600 dark:bg-green-900/30 dark:text-green-300",
                            ],
                            !isCorrect && [
                              "border-red-300 bg-red-100 text-red-800",
                              "hover:bg-red-200",
                              "dark:border-red-600 dark:bg-red-900/30 dark:text-red-300",
                            ],
                            isCurrent && "!border-2 !border-blue-500",
                          )}
                          onClick={() => scrollToQuestion(index)}
                        >
                          {index + 1}
                          {isCorrect ? (
                            <CheckCircle className="absolute -top-0.5 -right-0.5 h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="absolute -top-0.5 -right-0.5 h-3 w-3 text-red-600" />
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </ScrollArea>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Correcte
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Incorrecte
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Questions avec correction */}
          <div className="space-y-4 @[45rem]:col-span-3">
            {examWithQuestions.questions.map((question, index) => {
              if (!question) return null

              const userAnswer = userResult.answers.find(
                (a) => a.questionId === question._id,
              )
              const isCorrect = userAnswer?.isCorrect ?? false
              const isExpanded = expandedQuestions.has(index)

              return (
                <Card
                  key={question._id}
                  id={`question-${index}`}
                  className={`gap-2 border-l-4 shadow-lg ${
                    isCorrect
                      ? "border-l-green-500 bg-green-50/30 dark:bg-green-900/10"
                      : "border-l-red-500 bg-red-50/30 dark:bg-red-900/10"
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            isCorrect
                              ? "bg-green-100 dark:bg-green-900/30"
                              : "bg-red-100 dark:bg-red-900/30"
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <CardTitle className="text-sm @sm:text-xl">
                          Question {index + 1}
                        </CardTitle>
                      </div>

                      <div className="flex flex-col items-end gap-1 @sm:flex-row @sm:items-center @sm:justify-start">
                        <Badge variant={isCorrect ? "default" : "destructive"}>
                          {isCorrect ? "Correcte" : "Incorrecte"}
                        </Badge>
                        <Badge className="max-w-32 truncate bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {question.domain}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Question */}
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                      <p className="text-sm leading-relaxed font-semibold break-words text-gray-900 sm:text-base dark:text-white">
                        {question.question}
                      </p>
                    </div>

                    {/* Image si présente */}
                    {question.imageSrc && (
                      <div className="flex justify-center">
                        <Image
                          src={question.imageSrc}
                          alt="Question illustration"
                          className="h-auto max-w-full rounded-lg shadow-md"
                          width={500}
                          height={300}
                        />
                      </div>
                    )}

                    {/* Options avec correction */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Options de réponse :
                      </h3>

                      {question.options.map((option, optionIndex) => {
                        const isUserChoice =
                          userAnswer?.selectedAnswer === option
                        const isCorrectAnswer =
                          question.correctAnswer === option

                        let optionClass =
                          "p-2 sm:p-3 rounded-lg border text-xs sm:text-sm transition-all duration-200 "

                        if (isCorrectAnswer) {
                          optionClass +=
                            "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300"
                        } else if (isUserChoice && !isCorrectAnswer) {
                          optionClass +=
                            "bg-red-100 border-red-400 text-red-800 dark:bg-red-900/30 dark:border-red-600 dark:text-red-300"
                        } else {
                          optionClass +=
                            "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                        }

                        return (
                          <div key={optionIndex} className={optionClass}>
                            <div className="flex items-center space-x-2">
                              <span className="flex-shrink-0 font-semibold">
                                {String.fromCharCode(65 + optionIndex)}.
                              </span>
                              <span className="flex-1 break-words">
                                {option}
                              </span>
                              {isCorrectAnswer && (
                                <CheckCircle className="size-3 flex-shrink-0 text-green-600 sm:size-4" />
                              )}
                              {isUserChoice && !isCorrectAnswer && (
                                <XCircle className="size-3 flex-shrink-0 text-red-600 sm:size-4" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Section collapsible pour explications et références */}
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => toggleQuestionExpansion(index)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex w-full cursor-pointer items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            <span>Explications et références</span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="mt-4 space-y-4">
                        {/* Explication */}
                        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                          <h4 className="mb-2 text-sm font-semibold text-blue-900 sm:text-base dark:text-blue-100">
                            Explication :
                          </h4>
                          <p className="text-xs leading-relaxed break-words whitespace-pre-line text-blue-800 sm:text-sm dark:text-blue-200">
                            {question.explanation}
                          </p>
                        </div>

                        {/* Objectif CMC */}
                        <div className="rounded-lg bg-purple-50 p-4 sm:text-base dark:bg-purple-900/20">
                          <h4 className="mb-2 text-sm font-semibold text-purple-900 dark:text-purple-300">
                            Objectif CMC :
                          </h4>
                          <p className="text-xs leading-relaxed break-words whitespace-pre-line text-purple-800 sm:text-sm dark:text-purple-200">
                            {question.objectifCMC}
                          </p>
                        </div>

                        {/* Références */}
                        {question.references &&
                          question.references.length > 0 && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4 dark:border-gray-800 dark:bg-gray-900/20">
                              <h4 className="mb-3 text-sm font-semibold text-gray-900 sm:text-base dark:text-gray-100">
                                Références :
                              </h4>
                              <div className="space-y-1 sm:space-y-2">
                                {question.references.map((ref, refIndex) => (
                                  <div
                                    key={refIndex}
                                    className="border-l-2 border-gray-300 pl-2 text-xs leading-relaxed break-words whitespace-pre-line text-gray-700 sm:pl-3 sm:text-sm dark:border-gray-600 dark:text-gray-300"
                                  >
                                    <span className="mr-1 font-semibold text-blue-600 sm:mr-2">
                                      {refIndex + 1}.
                                    </span>
                                    {ref}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {/* Navigation flottante */}
      <div className="fixed right-6 bottom-6 z-50 flex flex-col space-y-3">
        {/* Menu de navigation des questions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="h-12 w-12 cursor-pointer rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
            >
              <List className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-96 w-80 overflow-y-auto border border-gray-200 dark:border-gray-700"
          >
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Navigation des questions
              </h3>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-8 gap-2">
                {examWithQuestions.questions.map((_, index) => {
                  const userAnswer = userResult.answers.find(
                    (a) =>
                      a.questionId === examWithQuestions.questions[index]?._id,
                  )
                  const isCorrect = userAnswer?.isCorrect ?? false

                  return (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "relative h-8 w-8 p-0 text-xs",
                        isCorrect && [
                          "border-green-300 bg-green-100 text-green-800",
                          "hover:bg-green-200",
                          "dark:border-green-600 dark:bg-green-900/30 dark:text-green-300",
                        ],
                        !isCorrect && [
                          "border-red-300 bg-red-100 text-red-800",
                          "hover:bg-red-200",
                          "dark:border-red-600 dark:bg-red-900/30 dark:text-red-300",
                        ],
                      )}
                      onClick={() => scrollToQuestion(index)}
                    >
                      {index + 1}
                      {isCorrect ? (
                        <CheckCircle className="absolute -top-1 -right-1 h-2.5 w-2.5 text-green-600" />
                      ) : (
                        <XCircle className="absolute -top-1 -right-1 h-2.5 w-2.5 text-red-600" />
                      )}
                    </Button>
                  )
                })}
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Correcte
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-red-600" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Incorrecte
                  </span>
                </div>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bouton scroll to top */}
        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            size="lg"
            className="animate-in fade-in h-12 w-12 cursor-pointer rounded-full bg-gray-600 text-white shadow-lg duration-200 hover:bg-gray-700"
          >
            <ArrowUp className="h-6 w-6" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default ResultsPage
