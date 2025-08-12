import StartQuizCTA from "../_components/StartQuizCTA"
import EvaluationHeader from "./_components/EvaluationHeader"
import EvaluationInstructions from "./_components/EvaluationInstructions"
import EvaluationStats from "./_components/EvaluationStats"

export default function EvaluationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-20 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EvaluationHeader />
        <EvaluationInstructions />
        <EvaluationStats />
        <StartQuizCTA />
      </div>
    </div>
  )
}
