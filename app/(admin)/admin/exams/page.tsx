"use client"

import Link from "next/link"
import { ExamsList } from "@/components/admin/ExamsList"
import { Button } from "@/components/ui/button"

const AdminExamsPage = () => {
  return (
    <div className="@container flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div className="flex flex-col justify-between gap-4 @md:flex-row @md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Examens</h1>
          <p className="text-muted-foreground">
            Ajoutez, modifiez et gérez tous vos examens
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/admin/exams/create">Créer un nouvel examen</Link>
        </Button>
      </div>

      <ExamsList />
    </div>
  )
}

export default AdminExamsPage
