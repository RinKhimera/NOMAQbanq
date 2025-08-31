"use client"

import { List, Plus } from "lucide-react"
import QuestionForm from "@/components/QuestionForm"
import QuestionsList from "@/components/QuestionsList"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const AdminQuestionsPage = () => {
  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-600">
          Gestion des Questions
        </h1>
        <p className="text-muted-foreground">
          Ajoutez, modifiez et gérez toutes vos questions QCM
        </p>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="bg-card grid w-full grid-cols-2">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Gérer les questions
          </TabsTrigger>
          <TabsTrigger value="add" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une question
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <QuestionsList />
        </TabsContent>

        <TabsContent value="add" className="mt-6">
          <QuestionForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminQuestionsPage
