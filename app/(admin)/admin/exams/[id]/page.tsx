"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ExamDetails } from "@/components/admin/ExamDetails"
import { Button } from "@/components/ui/button"
import { Id } from "@/convex/_generated/dataModel"

const AdminExamDetailsPage = () => {
  const params = useParams()
  const examId = params.id as Id<"exams">

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/exams">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux examens
          </Link>
        </Button>
      </div>

      <ExamDetails examId={examId} />
    </div>
  )
}

export default AdminExamDetailsPage
