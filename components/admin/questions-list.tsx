"use client"

import { useMutation, usePaginatedQuery } from "convex/react"
import { BookOpen, Filter, Loader2, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  QuestionCard,
  createEditAction,
  createPermanentDeleteAction,
} from "@/components/quiz/question-card"
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
import EditQuestionDialog from "./edit-question-dialog"

export default function QuestionsList() {
  const [selectedDomain, setSelectedDomain] = useState("Tous les domaines")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [editingQuestion, setEditingQuestion] =
    useState<Doc<"questions"> | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleDomainChange = (domain: string) => {
    setSelectedDomain(domain)
  }

  const { results, status, loadMore } = usePaginatedQuery(
    api.questions.getQuestionsWithPagination,
    {
      domain: selectedDomain,
      searchQuery: debouncedSearch,
    },
    { initialNumItems: 10 },
  )

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
              <Select value={selectedDomain} onValueChange={handleDomainChange}>
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
          Questions trouvées: {results.length}
          {status === "LoadingMore" && " (chargement...)"}
        </h3>
      </div>

      {/* Liste des questions */}
      <div className="grid gap-4">
        {results.map((question, index) => (
          <QuestionCard
            key={question._id}
            variant="default"
            question={question}
            questionNumber={index + 1}
            actions={[
              createEditAction(() => handleEdit(question)),
              createPermanentDeleteAction(() =>
                handleDeleteClick(question._id),
              ),
            ]}
          />
        ))}
      </div>

      {/* Load More Button */}
      {status === "CanLoadMore" && (
        <div className="flex justify-center py-4">
          <Button onClick={() => loadMore(10)} variant="outline">
            Charger plus de questions
          </Button>
        </div>
      )}

      {status === "LoadingMore" && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {status === "LoadingFirstPage" && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {results.length === 0 && status === "Exhausted" && (
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
