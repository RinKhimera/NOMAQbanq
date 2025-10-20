"use client"

import { useMutation, useQuery } from "convex/react"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Plus,
  Search,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import QuestionDetailsDialog from "@/components/QuestionDetailsDialog"
import ReusableQuestionCard, {
  createAddAction,
  createDeleteAction,
  createViewAction,
} from "@/components/ReusableQuestionCard"
import { Button } from "@/components/ui/button"
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

export default function LearningBankPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedDomain, setSelectedDomain] = useState<string>("all")
  const [selectedQuestion, setSelectedQuestion] =
    useState<Doc<"questions"> | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [bankPage, setBankPage] = useState(1)
  const [availablePage, setAvailablePage] = useState(1)
  const limit = 10

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setBankPage(1)
      setAvailablePage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset pages lors du changement de domaine
  useEffect(() => {
    setBankPage(1)
    setAvailablePage(1)
  }, [selectedDomain])

  const learningBankData = useQuery(
    api.questions.getLearningBankQuestionsWithPagination,
    {
      page: bankPage,
      limit,
      domain: selectedDomain,
      searchQuery: debouncedSearch,
    },
  )

  const availableQuestionsData = useQuery(
    api.questions.getAvailableQuestionsWithPagination,
    {
      page: availablePage,
      limit,
      domain: selectedDomain,
      searchQuery: debouncedSearch,
    },
  )

  // Pour les statistiques (utiliser les anciennes queries sans pagination)
  const allLearningBankQuestions = useQuery(
    api.questions.getLearningBankQuestions,
  )
  const allAvailableQuestions = useQuery(
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
              {allLearningBankQuestions?.length || 0}
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
              {allAvailableQuestions?.length || 0}
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
            {learningBankData?.items.map((item) => (
              <div key={item._id} className="relative">
                {item.question && (
                  <ReusableQuestionCard
                    question={item.question}
                    compact
                    actions={[
                      createViewAction(() => handleViewDetails(item.question!)),
                      createDeleteAction(() =>
                        handleRemoveQuestion(item.questionId),
                      ),
                    ]}
                  />
                )}
              </div>
            ))}
            {learningBankData?.items.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Aucune question trouvée dans la banque d&apos;apprentissage
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Pagination Banque d'apprentissage */}
          {learningBankData && learningBankData.totalPages > 1 && (
            <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-0">
              <div className="text-muted-foreground text-sm">
                Affichage de {(learningBankData.currentPage - 1) * limit + 1} à{" "}
                {Math.min(
                  learningBankData.currentPage * limit,
                  learningBankData.totalItems,
                )}{" "}
                sur {learningBankData.totalItems} question
                {learningBankData.totalItems > 1 ? "s" : ""}
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setBankPage(1)}
                  disabled={learningBankData.currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setBankPage(learningBankData.currentPage - 1)}
                  disabled={learningBankData.currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-sm">Page</span>
                  <span className="text-sm font-medium">
                    {learningBankData.currentPage}
                  </span>
                  <span className="text-sm">sur</span>
                  <span className="text-sm font-medium">
                    {learningBankData.totalPages}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setBankPage(learningBankData.currentPage + 1)}
                  disabled={
                    learningBankData.currentPage === learningBankData.totalPages
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setBankPage(learningBankData.totalPages)}
                  disabled={
                    learningBankData.currentPage === learningBankData.totalPages
                  }
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="@container space-y-4">
          <div className="grid gap-4">
            {availableQuestionsData?.questions.map((question) => (
              <ReusableQuestionCard
                key={question._id}
                question={question}
                compact
                actions={[
                  createViewAction(() => handleViewDetails(question)),
                  createAddAction(() => handleAddQuestion(question._id)),
                ]}
              />
            ))}
            {availableQuestionsData?.questions.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Aucune question disponible à ajouter
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Pagination Questions disponibles */}
          {availableQuestionsData && availableQuestionsData.totalPages > 1 && (
            <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-0">
              <div className="text-muted-foreground text-sm">
                Affichage de{" "}
                {(availableQuestionsData.currentPage - 1) * limit + 1} à{" "}
                {Math.min(
                  availableQuestionsData.currentPage * limit,
                  availableQuestionsData.totalQuestions,
                )}{" "}
                sur {availableQuestionsData.totalQuestions} question
                {availableQuestionsData.totalQuestions > 1 ? "s" : ""}
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setAvailablePage(1)}
                  disabled={availableQuestionsData.currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setAvailablePage(availableQuestionsData.currentPage - 1)
                  }
                  disabled={availableQuestionsData.currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-sm">Page</span>
                  <span className="text-sm font-medium">
                    {availableQuestionsData.currentPage}
                  </span>
                  <span className="text-sm">sur</span>
                  <span className="text-sm font-medium">
                    {availableQuestionsData.totalPages}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setAvailablePage(availableQuestionsData.currentPage + 1)
                  }
                  disabled={
                    availableQuestionsData.currentPage ===
                    availableQuestionsData.totalPages
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setAvailablePage(availableQuestionsData.totalPages)
                  }
                  disabled={
                    availableQuestionsData.currentPage ===
                    availableQuestionsData.totalPages
                  }
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
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
