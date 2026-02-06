"use client"

import { Eye, EyeOff, RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Doc } from "@/convex/_generated/dataModel"
import { QuestionCard } from "./question-card"
import QuestionNavigation from "./question-navigation"

interface QuizResultsProps {
  questions: Doc<"questions">[]
  userAnswers: (string | null)[]
  score: number
  timeRemaining: number
  onRestart: () => void
}

export default function QuizResults({
  questions,
  userAnswers,
  score,
  timeRemaining,
  onRestart,
}: QuizResultsProps) {
  const router = useRouter()
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set(),
  )

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100
    if (percentage >= 80) return "text-green-600"
    if (percentage >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreMessage = (score: number, total: number) => {
    const percentage = (score / total) * 100
    if (percentage >= 80) return "Excellent ! Vous maîtrisez bien le sujet."
    if (percentage >= 60) return "Bien ! Continuez à vous entraîner."
    return "Vous devez approfondir vos connaissances."
  }

  const expandAll = () => {
    const allQuestions = new Set(questions.map((_, index) => index + 1))
    setExpandedQuestions(allQuestions)
  }

  const collapseAll = () => {
    setExpandedQuestions(new Set())
  }

  const totalQuestions = questions.length
  const percentage = ((score / totalQuestions) * 100).toFixed(0)

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 pt-20 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Résumé du score */}
        <Card className="card-modern mb-8">
          <CardHeader className="text-center">
            <CardTitle className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
              Quiz Terminé !
            </CardTitle>
            <div className="mb-6 flex justify-center">
              <div
                className={`text-6xl font-bold ${getScoreColor(score, totalQuestions)}`}
              >
                {score}/{totalQuestions}
              </div>
            </div>
            <p className="mb-4 text-lg text-gray-600 dark:text-gray-300">
              {getScoreMessage(score, totalQuestions)}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Score
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {percentage}%
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Temps restant
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatTime(timeRemaining)}
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                onClick={onRestart}
                className="rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-8 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Recommencer
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/evaluation")}
                className="rounded-xl border-2 border-gray-300 px-8 py-3 font-semibold transition-all duration-300 hover:border-gray-400"
              >
                Retour à l&apos;évaluation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Header de révision avec contrôles */}
        <div className="mb-6 flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Révision détaillée
          </h2>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={expandAll}
              className="flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>Tout développer</span>
            </Button>
            <Button
              variant="outline"
              onClick={collapseAll}
              className="flex items-center space-x-2"
            >
              <EyeOff className="h-4 w-4" />
              <span>Tout réduire</span>
            </Button>
          </div>
        </div>

        {/* Révision détaillée des questions */}
        <div className="space-y-6">
          {questions.map((question, index) => (
            <QuestionCard
              key={question._id}
              variant="review"
              question={question}
              userAnswer={userAnswers[index]}
              questionNumber={index + 1}
              isExpanded={expandedQuestions.has(index + 1)}
              onToggleExpand={() => {
                const newExpanded = new Set(expandedQuestions)
                if (expandedQuestions.has(index + 1)) {
                  newExpanded.delete(index + 1)
                } else {
                  newExpanded.add(index + 1)
                }
                setExpandedQuestions(newExpanded)
              }}
            />
          ))}
        </div>

        {/* Navigation flottante */}
        <QuestionNavigation
          questions={questions}
          userAnswers={userAnswers}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
      </div>
    </div>
  )
}
