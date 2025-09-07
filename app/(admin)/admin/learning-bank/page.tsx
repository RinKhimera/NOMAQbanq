"use client"

import { useMutation, useQuery } from "convex/react"
import { BookOpen, Filter, Plus, Search } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import QuestionDetailsDialog from "@/components/QuestionDetailsDialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MEDICAL_DOMAINS } from "@/constants"
import { api } from "@/convex/_generated/api"
import { Doc, Id } from "@/convex/_generated/dataModel"
import QuestionCard from "./_components/question-card"

export default function LearningBankPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDomain, setSelectedDomain] = useState<string>("all")
  const [selectedQuestion, setSelectedQuestion] =
    useState<Doc<"questions"> | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)

  const learningBankQuestions = useQuery(api.questions.getLearningBankQuestions)
  const availableQuestions = useQuery(
    api.questions.getQuestionsNotInLearningBank,
  )

  const addToLearningBank = useMutation(api.questions.addQuestionToLearningBank)
  const removeFromLearningBank = useMutation(
    api.questions.removeQuestionFromLearningBank,
  )

  const handleAddQuestion = async (questionId: Id<"questions">) => {
    try {
      await addToLearningBank({ questionId })
      toast.success("Question ajoutée à la banque d'apprentissage")
    } catch {
      toast.error("Erreur lors de l'ajout de la question")
    }
  }

  const handleRemoveQuestion = async (questionId: Id<"questions">) => {
    try {
      await removeFromLearningBank({ questionId })
      toast.success("Question retirée de la banque d'apprentissage")
    } catch {
      toast.error("Erreur lors de la suppression de la question")
    }
  }

  const handleViewDetails = (question: Doc<"questions">) => {
    setSelectedQuestion(question)
    setIsDetailsDialogOpen(true)
  }

  const filteredLearningBankQuestions = learningBankQuestions?.filter(
    (item) => {
      const matchesSearch =
        item.question?.question
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        item.question?.domain.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDomain =
        selectedDomain === "all" || item.question?.domain === selectedDomain
      return matchesSearch && matchesDomain
    },
  )

  const filteredAvailableQuestions = availableQuestions?.filter((question) => {
    const matchesSearch =
      question.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      question.domain.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDomain =
      selectedDomain === "all" || question.domain === selectedDomain
    return matchesSearch && matchesDomain
  })

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-600">
          Banque d&apos;apprentissage
        </h1>
        <p className="text-muted-foreground">
          Gérez les questions disponibles pour l&apos;entraînement des
          utilisateurs
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Questions dans la banque
            </CardTitle>
            <BookOpen className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {learningBankQuestions?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Questions disponibles
            </CardTitle>
            <Plus className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {availableQuestions?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
          <Input
            placeholder="Rechercher une question..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={selectedDomain} onValueChange={setSelectedDomain}>
          <SelectTrigger className="w-[250px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrer par domaine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les domaines</SelectItem>
            {MEDICAL_DOMAINS.map((domain) => (
              <SelectItem key={domain} value={domain}>
                {domain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Onglets */}
      <Tabs defaultValue="bank" className="space-y-4">
        <TabsList className="bg-card grid w-full grid-cols-2">
          <TabsTrigger className="cursor-pointer" value="bank">
            Banque d&apos;apprentissage
          </TabsTrigger>
          <TabsTrigger className="cursor-pointer" value="available">
            Questions disponibles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bank" className="@container space-y-4">
          <div className="grid gap-4">
            {filteredLearningBankQuestions?.map((item) => (
              <div key={item._id} className="relative">
                {item.question && (
                  <QuestionCard
                    question={item.question}
                    onViewDetails={() => handleViewDetails(item.question!)}
                    onDelete={() => handleRemoveQuestion(item.questionId)}
                  />
                )}
              </div>
            ))}
            {filteredLearningBankQuestions?.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Aucune question trouvée dans la banque d&apos;apprentissage
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="available" className="@container space-y-4">
          <div className="grid gap-4">
            {filteredAvailableQuestions?.map((question) => (
              <QuestionCard
                key={question._id}
                question={question}
                onViewDetails={() => handleViewDetails(question)}
                onAdd={() => handleAddQuestion(question._id)}
                showActions={true}
              />
            ))}
            {filteredAvailableQuestions?.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Aucune question disponible à ajouter
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog pour les détails de la question */}
      <QuestionDetailsDialog
        question={selectedQuestion}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
      />
    </div>
  )
}
