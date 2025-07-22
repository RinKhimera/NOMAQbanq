"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Timer,
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
} from "lucide-react"
import Image from "next/image"
import { Doc } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

interface QuizState {
  currentQuestion: number
  selectedAnswer: string | null
  showFeedback: boolean
  userAnswers: (string | null)[]
  score: number
  isCompleted: boolean
  timeRemaining: number
  totalTime: number
}

export default function QuizPage() {
  const router = useRouter()
  const questions = useQuery(api.questions.getAllQuestions)
  const topOfQuizRef = useRef<HTMLDivElement>(null)

  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestion: 0,
    selectedAnswer: null,
    showFeedback: false,
    userAnswers: new Array(10).fill(null),
    score: 0,
    isCompleted: false,
    timeRemaining: 200,
    totalTime: 200,
  })

  // Sélectionner 10 questions aléatoires
  const [quizQuestions, setQuizQuestions] = useState<Doc<"questions">[]>([])

  useEffect(() => {
    if (questions && questions.length > 0) {
      const shuffled = [...questions].sort(() => 0.5 - Math.random())
      const selectedQuestions = shuffled.slice(
        0,
        Math.min(10, questions.length)
      )
      setQuizQuestions(selectedQuestions)

      // Ajuster le nombre de réponses utilisateur si on a moins de 10 questions
      if (selectedQuestions.length < 10) {
        setQuizState((prev) => ({
          ...prev,
          userAnswers: new Array(selectedQuestions.length).fill(null),
          timeRemaining: selectedQuestions.length * 20, // 20 secondes par question
          totalTime: selectedQuestions.length * 20,
        }))
      }
    }
  }, [questions])

  // Timer
  useEffect(() => {
    if (
      quizState.timeRemaining > 0 &&
      !quizState.isCompleted &&
      !quizState.showFeedback
    ) {
      const timer = setTimeout(() => {
        setQuizState((prev) => ({
          ...prev,
          timeRemaining: prev.timeRemaining - 1,
        }))
      }, 1000)
      return () => clearTimeout(timer)
    } else if (quizState.timeRemaining === 0) {
      // Temps écoulé, terminer le quiz
      setQuizState((prev) => ({ ...prev, isCompleted: true }))
    }
  }, [quizState.timeRemaining, quizState.isCompleted, quizState.showFeedback])

  // Scroll vers le haut quand la question change
  useEffect(() => {
    // On ne scroll que si ce n'est pas la première question
    if (quizState.currentQuestion > 0) {
      topOfQuizRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }, [quizState.currentQuestion])

  const handleAnswerSelect = (answerIndex: number) => {
    if (quizState.showFeedback) return

    const selectedOption =
      quizQuestions[quizState.currentQuestion].options[answerIndex]
    const newUserAnswers = [...quizState.userAnswers]
    newUserAnswers[quizState.currentQuestion] = selectedOption

    const isCorrect =
      selectedOption === quizQuestions[quizState.currentQuestion].correctAnswer
    const newScore = isCorrect ? quizState.score + 1 : quizState.score

    setQuizState((prev) => ({
      ...prev,
      selectedAnswer: selectedOption,
      showFeedback: true,
      userAnswers: newUserAnswers,
      score: newScore,
    }))
  }

  const handleNextQuestion = () => {
    if (quizState.currentQuestion < quizQuestions.length - 1) {
      setQuizState((prev) => ({
        ...prev,
        currentQuestion: prev.currentQuestion + 1,
        selectedAnswer: null,
        showFeedback: false,
      }))
    } else {
      // Quiz terminé
      setQuizState((prev) => ({ ...prev, isCompleted: true }))
    }
  }

  const restartQuiz = () => {
    if (questions && questions.length > 0) {
      const shuffled = [...questions].sort(() => 0.5 - Math.random())
      const selectedQuestions = shuffled.slice(
        0,
        Math.min(10, questions.length)
      )
      setQuizQuestions(selectedQuestions)

      setQuizState({
        currentQuestion: 0,
        selectedAnswer: null,
        showFeedback: false,
        userAnswers: new Array(selectedQuestions.length).fill(null),
        score: 0,
        isCompleted: false,
        timeRemaining: selectedQuestions.length * 20,
        totalTime: selectedQuestions.length * 20,
      })
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600"
    if (score >= 6) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreMessage = (score: number) => {
    if (score >= 8) return "Excellent ! Vous maîtrisez bien le sujet."
    if (score >= 6) return "Bien ! Continuez à vous entraîner."
    return "Vous devez approfondir vos connaissances."
  }

  if (!questions || questions.length === 0 || quizQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            {!questions
              ? "Chargement des questions..."
              : questions.length === 0
                ? "Aucune question disponible dans la base de données."
                : "Préparation du quiz..."}
          </p>
        </div>
      </div>
    )
  }

  // Écran de résultats
  if (quizState.isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card className="card-modern">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Quiz Terminé !
              </CardTitle>
              <div className="flex justify-center mb-6">
                <div
                  className={`text-6xl font-bold ${getScoreColor(quizState.score)}`}
                >
                  {quizState.score}/{quizQuestions.length}
                </div>
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                {getScoreMessage(quizState.score)}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Score
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {((quizState.score / quizQuestions.length) * 100).toFixed(
                      0
                    )}
                    %
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Temps restant
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatTime(quizState.timeRemaining)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={restartQuiz}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Recommencer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/evaluation")}
                  className="px-8 py-3 rounded-xl font-semibold border-2 border-gray-300 hover:border-gray-400 transition-all duration-300"
                >
                  Retour à l&apos;évaluation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const currentQ = quizQuestions[quizState.currentQuestion]
  const progress =
    ((quizState.currentQuestion + 1) / quizQuestions.length) * 100

  return (
    <div
      ref={topOfQuizRef}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20"
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Header avec progress et timer */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 space-y-2 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <Badge
                variant="outline"
                className="px-2 py-1 text-xs sm:text-sm w-fit"
              >
                Question {quizState.currentQuestion + 1} sur{" "}
                {quizQuestions.length}
              </Badge>
              <Badge className="px-2 py-1 text-xs sm:text-sm capitalize bg-gradient-to-r from-purple-500 to-pink-500 text-white w-fit">
                {currentQ.domain}
              </Badge>
            </div>
            <div className="flex items-center space-x-2 text-base sm:text-lg font-semibold">
              <Timer className="h-4 w-4 sm:h-5 sm:w-5" />
              <span
                className={
                  quizState.timeRemaining <= 30
                    ? "text-red-600"
                    : "text-gray-700 dark:text-gray-300"
                }
              >
                {formatTime(quizState.timeRemaining)}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question */}
        <Card className="card-modern mb-6 sm:mb-8">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            {currentQ.imageSrc && currentQ.imageSrc.trim() !== "" && (
              <div className="mb-4 sm:mb-6 rounded-xl overflow-hidden">
                <Image
                  src={currentQ.imageSrc}
                  alt="Question illustration"
                  width={800}
                  height={256}
                  className="w-full h-48 sm:h-64 object-cover"
                />
              </div>
            )}
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6 leading-relaxed">
              {currentQ.question}
            </h2>

            <div className="space-y-3">
              {currentQ.options.map((option, index) => {
                let buttonClass =
                  "w-full p-3 sm:p-4 text-left rounded-xl border-2 transition-all duration-200 hover:shadow-md text-sm sm:text-base"

                const isCorrectAnswer = option === currentQ.correctAnswer
                const isSelectedAnswer = option === quizState.selectedAnswer // ← Comparaison string vs string

                if (quizState.showFeedback) {
                  if (isCorrectAnswer) {
                    buttonClass +=
                      " bg-green-100 border-green-400 text-green-800 dark:bg-green-900/20 dark:border-green-600 dark:text-green-300"
                  } else if (isSelectedAnswer) {
                    buttonClass +=
                      " bg-red-100 border-red-400 text-red-800 dark:bg-red-900/20 dark:border-red-600 dark:text-red-300"
                  } else {
                    buttonClass +=
                      " bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
                  }
                } else {
                  buttonClass +=
                    " bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={quizState.showFeedback}
                    className={buttonClass}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-semibold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {quizState.showFeedback && isCorrectAnswer && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      {quizState.showFeedback &&
                        isSelectedAnswer &&
                        !isCorrectAnswer && (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Feedback */}
        {quizState.showFeedback && (
          <Card className="card-modern mb-6 sm:mb-8">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start space-x-3">
                {quizState.selectedAnswer === currentQ.correctAnswer ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {quizState.selectedAnswer === currentQ.correctAnswer
                      ? "Correct !"
                      : "Incorrect"}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 whitespace-pre-line">
                    {currentQ.explanation}
                  </p>
                  {currentQ.references && currentQ.references.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">
                        Références :
                      </h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        {currentQ.references.map(
                          (ref: string, index: number) => (
                            <li key={index} className="flex items-start">
                              <span className="text-blue-600 mr-2 font-semibold">
                                {index + 1}.
                              </span>
                              <span className="whitespace-pre-line">{ref}</span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleNextQuestion}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      {quizState.currentQuestion < quizQuestions.length - 1 ? (
                        <>
                          Question suivante
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      ) : (
                        "Voir les résultats"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
