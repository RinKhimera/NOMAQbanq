"use client"

import { ArrowUp, List } from "lucide-react"
import { CheckCircle, Clock, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Doc } from "@/convex/_generated/dataModel"

interface QuestionNavigationProps {
  questions: Doc<"questions">[]
  userAnswers: (string | null)[]
  onExpandAll: () => void
  onCollapseAll: () => void
}

const QuestionNavigation = ({
  questions,
  userAnswers,
  onExpandAll,
  onCollapseAll,
}: QuestionNavigationProps) => {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const toggleScrollTop = () => {
      setShowScrollTop(window.pageYOffset > 300)
    }

    window.addEventListener("scroll", toggleScrollTop)
    return () => window.removeEventListener("scroll", toggleScrollTop)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  const scrollToQuestion = (questionNumber: number) => {
    const element = document.getElementById(`question-${questionNumber}`)
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }
  }

  const getQuestionStatus = (index: number) => {
    const userAnswer = userAnswers[index]
    const question = questions[index]

    if (userAnswer === null) {
      return {
        icon: <Clock className="h-4 w-4 text-gray-400" />,
        status: "Non répondu",
      }
    } else if (userAnswer === question.correctAnswer) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-600" />,
        status: "Correct",
      }
    } else {
      return {
        icon: <XCircle className="h-4 w-4 text-red-600" />,
        status: "Incorrect",
      }
    }
  }

  return (
    <>
      {/* Navigation flottante */}
      <div className="fixed right-6 bottom-6 z-50 flex flex-col space-y-3">
        {/* Menu de navigation des questions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              aria-label="Navigation des questions"
              className="h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
            >
              <List className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="glass-card max-h-96 w-80 overflow-y-auto border border-gray-200 dark:border-gray-700"
          >
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Navigation
                </h3>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onExpandAll()
                    }}
                    className="text-xs"
                  >
                    Tout ouvrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onCollapseAll()
                    }}
                    className="text-xs"
                  >
                    Tout fermer
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {questions.map((_, index) => {
                const questionNumber = index + 1
                const status = getQuestionStatus(index)

                return (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => scrollToQuestion(questionNumber)}
                    className="flex cursor-pointer items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold dark:bg-gray-700">
                        {questionNumber}
                      </span>
                      <span className="text-sm">Question {questionNumber}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {status.icon}
                      <span className="text-xs text-gray-500">
                        {status.status}
                      </span>
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bouton scroll to top */}
        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            size="lg"
            aria-label="Retour en haut"
            className="animate-in fade-in h-12 w-12 rounded-full bg-gray-600 text-white shadow-lg duration-200 hover:bg-gray-700"
          >
            <ArrowUp className="h-6 w-6" />
          </Button>
        )}
      </div>
    </>
  )
}

export default QuestionNavigation
