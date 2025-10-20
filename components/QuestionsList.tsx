"use client"

import { useMutation, useQuery } from "convex/react"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Search,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { MEDICAL_DOMAINS } from "@/constants"
import { api } from "@/convex/_generated/api"
import { Doc, Id } from "@/convex/_generated/dataModel"
import EditQuestionDialog from "./EditQuestionDialog"
import ReusableQuestionCard, {
  createEditAction,
  createPermanentDeleteAction,
} from "./ReusableQuestionCard"

export default function QuestionsList() {
  const [selectedDomain, setSelectedDomain] = useState("Tous les domaines")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [editingQuestion, setEditingQuestion] =
    useState<Doc<"questions"> | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const limit = 10

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedDomain])

  const questionsData = useQuery(api.questions.getQuestionsWithPagination, {
    page: currentPage,
    limit,
    domain: selectedDomain,
    searchQuery: debouncedSearch,
  })

  const deleteQuestion = useMutation(api.questions.deleteQuestion)

  const domainOptions = ["Tous les domaines", ...MEDICAL_DOMAINS]

  const handleEdit = (question: Doc<"questions">) => {
    setEditingQuestion(question)
    setIsEditDialogOpen(true)
  }

  const handleDeleteClick = (questionId: string) => {
    setQuestionToDelete(questionId)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!questionToDelete) return
    try {
      await deleteQuestion({ id: questionToDelete as Id<"questions"> })
      toast.success("Question supprimée avec succès")
      setIsDeleteDialogOpen(false)
      setQuestionToDelete(null)
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
      toast.error("Erreur lors de la suppression")
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtres et recherche */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres et recherche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  placeholder="Rechercher dans les questions ou objectifs CMC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {domainOptions.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Résultats */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Questions trouvées: {questionsData?.totalQuestions || 0}
        </h3>
      </div>

      {/* Liste des questions */}
      <div className="grid gap-4">
        {questionsData?.questions.map((question, index) => (
          <ReusableQuestionCard
            key={question._id}
            question={question}
            questionNumber={(questionsData.currentPage - 1) * limit + index + 1}
            compact
            actions={[
              createEditAction(() => handleEdit(question)),
              createPermanentDeleteAction(() =>
                handleDeleteClick(question._id),
              ),
            ]}
          />
        ))}
      </div>

      {/* Pagination */}
      {questionsData && questionsData.totalPages > 1 && (
        <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-0">
          <div className="text-muted-foreground text-sm">
            Affichage de {(questionsData.currentPage - 1) * limit + 1} à{" "}
            {Math.min(
              questionsData.currentPage * limit,
              questionsData.totalQuestions,
            )}{" "}
            sur {questionsData.totalQuestions} question
            {questionsData.totalQuestions > 1 ? "s" : ""}
          </div>
          <div className="flex items-center justify-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={questionsData.currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(questionsData.currentPage - 1)}
              disabled={questionsData.currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-sm">Page</span>
              <span className="text-sm font-medium">
                {questionsData.currentPage}
              </span>
              <span className="text-sm">sur</span>
              <span className="text-sm font-medium">
                {questionsData.totalPages}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(questionsData.currentPage + 1)}
              disabled={questionsData.currentPage === questionsData.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(questionsData.totalPages)}
              disabled={questionsData.currentPage === questionsData.totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {questionsData?.questions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
              Aucune question trouvée
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Aucune question ne correspond à vos critères de recherche.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialogue d'édition */}
      <EditQuestionDialog
        question={editingQuestion}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      {/* Dialogue de confirmation de suppression */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement cette question ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
