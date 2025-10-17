"use client"

import { useQuery } from "convex/react"
import { ArrowRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import QuestionCard from "@/components/quiz/QuestionCard"
import QuizProgress from "@/components/quiz/QuizProgress"
import QuizResults from "@/components/quiz/QuizResults"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"

interface QuizState {
  currentQuestion: number
  userAnswers: (string | null)[]
  isCompleted: boolean
  timeRemaining: number
  totalTime: number
}

export default function QuizPage() {
  const questions = useQuery(api.questions.getAllQuestions)
  const topOfQuizRef = useRef<HTMLDivElement>(null)

  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestion: 0,
    userAnswers: new Array(10).fill(null),
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
        Math.min(10, questions.length),
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
    if (quizState.timeRemaining > 0 && !quizState.isCompleted) {
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
  }, [quizState.timeRemaining, quizState.isCompleted])

  // Scroll vers le haut quand la question change
  useEffect(() => {
    if (quizState.currentQuestion > 0) {
      topOfQuizRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }, [quizState.currentQuestion])

  const handleAnswerSelect = (answerIndex: number) => {
    const selectedOption =
      quizQuestions[quizState.currentQuestion].options[answerIndex]
    const newUserAnswers = [...quizState.userAnswers]
    newUserAnswers[quizState.currentQuestion] = selectedOption

    setQuizState((prev) => ({
      ...prev,
      userAnswers: newUserAnswers,
    }))
  }

  const handleNextQuestion = () => {
    if (quizState.currentQuestion < quizQuestions.length - 1) {
      setQuizState((prev) => ({
        ...prev,
        currentQuestion: prev.currentQuestion + 1,
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
        Math.min(10, questions.length),
      )
      setQuizQuestions(selectedQuestions)

      setQuizState({
        currentQuestion: 0,
        userAnswers: new Array(selectedQuestions.length).fill(null),
        isCompleted: false,
        timeRemaining: selectedQuestions.length * 20,
        totalTime: selectedQuestions.length * 20,
      })
    }
  }

  const calculateScore = () => {
    return quizQuestions.reduce((score, question, index) => {
      return quizState.userAnswers[index] === question.correctAnswer
        ? score + 1
        : score
    }, 0)
  }

  if (!questions || questions.length === 0 || quizQuestions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-20 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
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
      <QuizResults
        questions={quizQuestions}
        userAnswers={quizState.userAnswers}
        score={calculateScore()}
        timeRemaining={quizState.timeRemaining}
        onRestart={restartQuiz}
      />
    )
  }

  const currentQ = quizQuestions[quizState.currentQuestion]
  const currentAnswer = quizState.userAnswers[quizState.currentQuestion]

  return (
    <div ref={topOfQuizRef} className="theme-bg min-h-screen pt-20">
      <div className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-8 lg:px-8">
        <QuizProgress
          currentQuestion={quizState.currentQuestion}
          totalQuestions={quizQuestions.length}
          timeRemaining={quizState.timeRemaining}
          domain={currentQ.domain}
          objectifCMC={currentQ.objectifCMC}
        />

        <QuestionCard
          question={currentQ}
          selectedAnswer={currentAnswer}
          onAnswerSelect={handleAnswerSelect}
        />

        {/* Bouton suivant */}
        <div className="flex justify-end">
          <Button
            onClick={handleNextQuestion}
            disabled={currentAnswer === null}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 font-semibold text-white shadow-lg transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quizState.currentQuestion < quizQuestions.length - 1 ? (
              <>
                Question suivante
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              "Voir les résultats"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
