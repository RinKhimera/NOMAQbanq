import { Suspense } from "react"
import { getExamsForPicker } from "@/features/exams/dal"
import { getQuestionStatsEnriched } from "@/features/questions/dal"
import { QuestionsManager } from "./_components/questions-manager"

// Stats chargées côté serveur (DAL admin) ; le QuestionBrowser (client) gère
// la liste paginée + filtres via Server Actions.
export default async function AdminQuestionsPage() {
  const [stats, examOptions] = await Promise.all([
    getQuestionStatsEnriched(),
    getExamsForPicker(),
  ])

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* useSearchParams (deep-link ?question=) → borné par Suspense. */}
      <Suspense fallback={null}>
        <QuestionsManager stats={stats} examOptions={examOptions} />
      </Suspense>
    </div>
  )
}
