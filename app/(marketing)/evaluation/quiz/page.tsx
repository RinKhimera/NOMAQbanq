"use client"

import { useQuery } from "convex/react"
import { ArrowRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { QuestionCard } from "@/components/quiz/question-card"
import QuizProgress from "@/components/quiz/quiz-progress"
import QuizResults from "@/components/quiz/quiz-results"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"

interface QuizState {
  currentQuestion: number
  userAnswers: (string | null)[]
  isCompleted: boolean
  timeRemaining: number
  totalTime: number
}

export default function QuizPage() {
  const quizQuestions = useQuery(api.questions.getRandomQuestions, {
    count: 10,
  })
  const topOfQuizRef = useRef<HTMLDivElement>(null)
  const [prevQuizQuestions, setPrevQuizQuestions] =
    useState<typeof quizQuestions>(undefined)

  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestion: 0,
    userAnswers: new Array(10).fill(null),
    isCompleted: false,
    timeRemaining: 200,
    totalTime: 200,
  })

  if (
    quizQuestions &&
    quizQuestions.length > 0 &&
    quizQuestions.length < 10 &&
    quizQuestions !== prevQuizQuestions
  ) {
    setPrevQuizQuestions(quizQuestions)
    setQuizState((prev) => ({
      ...prev,
      userAnswers: new Array(quizQuestions.length).fill(null),
      timeRemaining: quizQuestions.length * 20,
      totalTime: quizQuestions.length * 20,
    }))
  }

  // Timer - utiliser setInterval pour décrémenter le temps
  useEffect(() => {
    if (quizState.isCompleted) return

    const interval = setInterval(() => {
      setQuizState((prev) => {
        if (prev.timeRemaining <= 1) {
          clearInterval(interval)
          return { ...prev, timeRemaining: 0, isCompleted: true }
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [quizState.isCompleted])

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
    if (!quizQuestions) return
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
    if (!quizQuestions) return
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
    window.location.reload()
  }

  const calculateScore = () => {
    if (!quizQuestions) return 0
    return quizQuestions.reduce((score, question, index) => {
      return quizState.userAnswers[index] === question.correctAnswer
        ? score + 1
        : score
    }, 0)
  }

  if (!quizQuestions || quizQuestions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-20 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Chargement des questions...
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
          variant="exam"
          question={currentQ}
          selectedAnswer={currentAnswer}
          onAnswerSelect={handleAnswerSelect}
          showImage={true}
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
