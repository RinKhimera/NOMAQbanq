"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ExamDetails } from "@/app/(admin)/admin/exams/[id]/_components/ExamDetails"
import { Button } from "@/components/ui/button"
import { Id } from "@/convex/_generated/dataModel"

export default function AdminExamDetailsPage() {
  const params = useParams()
  const examId = params.id as Id<"exams">

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div className="flex items-center gap-3 md:gap-4">
        <Button
          className="hover:text-blue-700 dark:hover:text-white"
          variant="outline"
          size="sm"
          asChild
        >
          <Link href="/admin/exams">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Link>
        </Button>
        <h1 className="text-foreground text-lg font-semibold md:text-xl">
          Détails de l&apos;examen
        </h1>
      </div>

      <ExamDetails examId={examId} />
    </div>
  )
}
