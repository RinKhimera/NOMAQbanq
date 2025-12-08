"use client"

import {
  ArrowLeft,
  FileDown,
  FileText,
  ListChecks,
  MoreHorizontal,
  Pencil,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { ExamDetails } from "@/app/(admin)/admin/exams/[id]/_components/exam-details"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { sidebarMenuButtonVariants } from "@/components/ui/sidebar"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { ExamQuestionsModal } from "./_components/exam-questions-modal"

export default function AdminExamDetailsPage() {
  const params = useParams()
  const examId = params.id as Id<"exams">
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false)

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
            <Link href="/admin/exams">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-blue-600 md:text-xl dark:text-white">
            Détails de l&apos;examen
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="bg-blue-600 text-white max-[500px]:w-full max-[500px]:justify-start"
            asChild
            size="sm"
            variant="none"
          >
            <Link href={`/admin/exams/edit/${examId}`}>
              <Pencil className="mr-2 h-4 w-4" />
              Modifier l&apos;examen
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 hover:text-blue-700 max-[500px]:w-full max-[500px]:justify-start dark:hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" /> Exporter sous un format
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card w-full" align="start">
              <DropdownMenuLabel>Exporter</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={cn(
                  sidebarMenuButtonVariants({
                    variant: "link",
                  }),
                  "cursor-pointer focus:hover:bg-red-500/15 focus:hover:text-red-500 dark:focus:hover:bg-red-100 dark:focus:hover:text-red-400",
                )}
              >
                <FileDown className="mr-2 h-4 w-4 focus:hover:text-red-500 dark:focus:hover:text-red-400" />{" "}
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(
                  sidebarMenuButtonVariants({
                    variant: "link",
                  }),
                  "cursor-pointer focus:hover:bg-green-500/15 focus:hover:text-green-500 dark:focus:hover:bg-green-100 dark:focus:hover:text-green-400",
                )}
              >
                <FileText className="mr-2 h-4 w-4 focus:hover:text-green-500 dark:focus:hover:text-green-400" />{" "}
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            className="hover:text-blue-700 max-[500px]:w-full max-[500px]:justify-start dark:hover:text-white"
            size="sm"
            variant="outline"
            onClick={() => setIsQuestionsOpen(true)}
          >
            <ListChecks className="mr-2 h-4 w-4" /> Voir toutes les questions
          </Button>
        </div>
      </div>

      <ExamDetails examId={examId} isAdmin={true} />

      <ExamQuestionsModal
        examId={examId}
        open={isQuestionsOpen}
        onOpenChange={setIsQuestionsOpen}
      />
    </div>
  )
}
