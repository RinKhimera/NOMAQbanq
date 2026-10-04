import type { Metadata } from "next"
import { getExamsOverview } from "@/features/exams/dal"
import { currentTimeMs } from "@/lib/clock"
import { ExamsOverview } from "./_components/exams-overview"

export const metadata: Metadata = { title: "Examens blancs" }

export default async function AdminExamsPage() {
  const exams = await getExamsOverview()

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6">
      <ExamsOverview exams={exams} initialNow={currentTimeMs()} />
    </div>
  )
}
