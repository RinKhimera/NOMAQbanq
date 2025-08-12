import StartQuizCTA from "../_components/StartQuizCTA"
import EvaluationHeader from "./_components/EvaluationHeader"
import EvaluationInstructions from "./_components/EvaluationInstructions"
import EvaluationStats from "./_components/EvaluationStats"

export default function EvaluationPage() {
  return (
    <div className="theme-bg min-h-screen pt-20">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EvaluationHeader />
        <EvaluationInstructions />
        <EvaluationStats />
        <StartQuizCTA />
      </div>
    </div>
  )
}
