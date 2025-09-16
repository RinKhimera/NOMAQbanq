"use client"

import { ArrowLeft, BarChart3 } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ExamDetails } from "@/app/(admin)/admin/exams/[id]/_components/ExamDetails"
import { Button } from "@/components/ui/button"
import { Id } from "@/convex/_generated/dataModel"

export default function MockExamDetailsPage() {
  const params = useParams()
  const examId = params.examId as Id<"exams">

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <Button
            className="hover:text-blue-700 dark:hover:text-white"
            variant="outline"
            size="sm"
            asChild
          >
            <Link href="/dashboard/mock-exam">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-blue-600 md:text-xl">
            Détails de l&apos;examen
          </h1>
        </div>

        <Button
          className="bg-blue-600 text-white hover:bg-blue-700"
          size="sm"
          asChild
        >
          <Link href={`/dashboard/mock-exam/${examId}/results`}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Voir mes résultats
          </Link>
        </Button>
      </div>

      <ExamDetails examId={examId} />
    </div>
  )
}
