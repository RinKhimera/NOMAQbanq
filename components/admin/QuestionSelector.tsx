"use client"

import { useQuery } from "convex/react"
import { Search, Shuffle, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MEDICAL_DOMAINS } from "@/constants"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

interface QuestionSelectorProps {
  selectedQuestions: Id<"questions">[]
  onSelectionChange: (questions: Id<"questions">[]) => void
  maxQuestions?: number
}

export function QuestionSelector({
  selectedQuestions,
  onSelectionChange,
  maxQuestions = 230,
}: QuestionSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [domainFilter, setDomainFilter] = useState<string>("all")

  const questions = useQuery(api.questions.getAllQuestions)

  const filteredQuestions = useMemo(() => {
    if (!questions) return []

    return questions.filter((question) => {
      const matchesSearch =
        question.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        question.objectifCMC.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesDomain =
        domainFilter === "all" || question.domain === domainFilter

      return matchesSearch && matchesDomain
    })
  }, [questions, searchTerm, domainFilter])

  const handleQuestionToggle = (questionId: Id<"questions">) => {
    const isSelected = selectedQuestions.includes(questionId)

    if (isSelected) {
      // Toujours permettre de désélectionner
      const updated = selectedQuestions.filter((id) => id !== questionId)
      onSelectionChange(updated)
    } else {
      // Seulement permettre de sélectionner si le quota n'est pas atteint
      if (selectedQuestions.length < maxQuestions) {
        onSelectionChange([...selectedQuestions, questionId])
      }
    }
  }

  const handleAutoComplete = () => {
    if (!questions) return

    const remaining = maxQuestions - selectedQuestions.length
    if (remaining <= 0) return

    // Filtrer les questions non sélectionnées
    const availableQuestions = questions.filter(
      (q) => !selectedQuestions.includes(q._id),
    )

    // Mélanger et prendre le nombre nécessaire
    const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5)
    const randomQuestions = shuffled.slice(0, remaining)

    onSelectionChange([
      ...selectedQuestions,
      ...randomQuestions.map((q) => q._id),
    ])
  }

  const clearAll = () => {
    onSelectionChange([])
  }

  const isQuotaReached = selectedQuestions.length >= maxQuestions
  const canCreate = selectedQuestions.length >= maxQuestions

  return (
    <div className="@container space-y-4">
      {/* Header avec compteur et actions */}
      <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant={canCreate ? "default" : "destructive"}
            className="w-fit text-sm"
          >
            {selectedQuestions.length} / {maxQuestions} questions
          </Badge>
          {!canCreate && (
            <span className="text-muted-foreground text-sm">
              (minimum {maxQuestions} questions requis)
            </span>
          )}
          {isQuotaReached && (
            <Badge variant="outline" className="w-fit text-sm">
              Quota atteint
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-2 @[40rem]:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoComplete}
            disabled={isQuotaReached}
            className="w-full cursor-pointer @lg:w-auto"
          >
            <Shuffle className="mr-2 h-4 w-4" />
            Compléter automatiquement
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={selectedQuestions.length === 0}
            className="w-full cursor-pointer @lg:w-auto"
          >
            <X className="mr-2 h-4 w-4" />
            Tout effacer
          </Button>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-col gap-2 @lg:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Rechercher une question ou un objectif CMC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-full cursor-pointer @lg:w-[250px]">
            <SelectValue placeholder="Filtrer par domaine" />
          </SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem className="btn-link" value="all">
              Tous les domaines
            </SelectItem>
            {MEDICAL_DOMAINS?.map((domain) => (
              <SelectItem className="btn-link" key={domain} value={domain}>
                {domain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Statistiques rapides */}
      <div className="text-muted-foreground flex flex-wrap gap-2 text-sm">
        <span>
          {filteredQuestions.length} question
          {filteredQuestions.length > 1 ? "s" : ""} trouvée
          {filteredQuestions.length > 1 ? "s" : ""}
        </span>
        {searchTerm && (
          <span className="hidden @lg:inline">
            • Recherche: &ldquo;{searchTerm}&rdquo;
          </span>
        )}
        {domainFilter !== "all" && (
          <span className="hidden @lg:inline">• Domaine: {domainFilter}</span>
        )}
        {/* Version mobile plus compacte */}
        {searchTerm && (
          <span className="@lg:hidden">• &ldquo;{searchTerm}&rdquo;</span>
        )}
        {domainFilter !== "all" && (
          <span className="@lg:hidden">• {domainFilter}</span>
        )}
      </div>

      {/* Liste des questions */}
      <Card className="overflow-hidden">
        <ScrollArea className="h-[600px]">
          <div className="space-y-3 p-4 py-0">
            {filteredQuestions.map((question) => {
              const isSelected = selectedQuestions.includes(question._id)
              const isDisabled = !isSelected && isQuotaReached

              return (
                <div
                  key={question._id}
                  className={`flex min-w-0 items-start space-x-3 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-primary/20 bg-muted dark:bg-gray-900"
                      : isDisabled
                        ? "bg-muted/30 opacity-50"
                        : "bg-card hover:bg-muted dark:hover:bg-gray-900"
                  } `}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={() => handleQuestionToggle(question._id)}
                    className="mt-1 flex-shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p
                      className={`line-clamp-5 text-sm leading-relaxed @lg:line-clamp-3 ${
                        isDisabled ? "text-muted-foreground" : ""
                      }`}
                    >
                      {question.question}
                    </p>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        variant="badge"
                        className={`flex-shrink-0 text-[10px] @sm:text-xs ${isDisabled ? "opacity-60" : ""}`}
                      >
                        {question.domain}
                      </Badge>
                      <span className="flex-shrink-0">•</span>
                      <span className="break-words">
                        {question.objectifCMC}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredQuestions.length === 0 && (
              <div className="text-muted-foreground py-8 text-center">
                {searchTerm || domainFilter !== "all"
                  ? "Aucune question ne correspond aux critères de recherche"
                  : "Aucune question disponible"}
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}
