"use client"

import { useMutation, useQuery } from "convex/react"
import {
  BookOpen,
  CheckCircle,
  Edit,
  Eye,
  Filter,
  Search,
  Target,
  Trash2,
} from "lucide-react"
import { useState } from "react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
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

export default function QuestionsList() {
  const [selectedDomain, setSelectedDomain] = useState("Tous les domaines")
  const [searchQuery, setSearchQuery] = useState("")
  const [editingQuestion, setEditingQuestion] =
    useState<Doc<"questions"> | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const allQuestions = useQuery(api.questions.getAllQuestions)
  const deleteQuestion = useMutation(api.questions.deleteQuestion)

  // Créer la liste des domaines avec "Tous les domaines" en premier
  const domainOptions = ["Tous les domaines", ...MEDICAL_DOMAINS]

  const filteredQuestions = allQuestions?.filter((question) => {
    const matchesDomain =
      selectedDomain === "Tous les domaines" ||
      question.domain === selectedDomain
    const matchesSearch =
      question.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      question.objectifCMC.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesDomain && matchesSearch
  })

  const handleDelete = async (questionId: string) => {
    try {
      await deleteQuestion({ id: questionId as Id<"questions"> })
      toast.success("Question supprimée avec succès")
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
    }
  }

  const handleEdit = (question: Doc<"questions">) => {
    setEditingQuestion(question)
    setIsEditDialogOpen(true)
  }

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
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
          Questions trouvées: {filteredQuestions?.length || 0}
        </h3>
      </div>

      {/* Liste des questions */}
      <div className="grid gap-4">
        {filteredQuestions?.map((question) => (
          <Card
            key={question._id}
            className="transition-shadow hover:shadow-lg"
          >
            <CardContent>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                {/* Contenu principal */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-lg leading-relaxed font-medium">
                      {truncateText(question.question, 200)}
                    </h4>
                    <div className="flex flex-shrink-0 items-center gap-2 max-sm:hidden">
                      <Badge variant="secondary" className="text-xs">
                        {question.domain}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <Target className="h-4 w-4 flex-shrink-0" />
                      <span className="">{question.objectifCMC}</span>
                    </div>
                    {question.references && (
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span className="whitespace-nowrap">
                          {question.references.length} réf.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Options de réponse */}
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {question.options.map((option, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-2 rounded-lg p-2 text-sm ${
                          option === question.correctAnswer
                            ? "border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                            : "bg-muted dark:bg-muted/50"
                        }`}
                      >
                        <Badge
                          variant={
                            option === question.correctAnswer
                              ? "default"
                              : "outline"
                          }
                          className="flex h-6 min-w-[24px] items-center justify-center"
                        >
                          {String.fromCharCode(65 + index)}
                        </Badge>
                        <span
                          className={
                            option === question.correctAnswer
                              ? "font-medium"
                              : ""
                          }
                        >
                          {truncateText(option, 80)}
                        </span>
                        {option === question.correctAnswer && (
                          <CheckCircle className="ml-auto h-4 w-4 text-green-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 lg:flex-col">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => handleEdit(question)}
                  >
                    <Edit className="h-4 w-4" />
                    Éditer
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Confirmer la suppression
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir supprimer cette question ?
                          Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(question._id)}
                          className="text-primary bg-red-600 hover:bg-red-700"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredQuestions?.length === 0 && (
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
    </div>
  )
}
