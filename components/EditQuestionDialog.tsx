"use client"

import { useMutation, useQuery } from "convex/react"
import { Check, Minus, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { Doc, Id } from "@/convex/_generated/dataModel"

type EditQuestionDialogProps = {
  question: Doc<"questions"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EditQuestionDialog({
  question,
  open,
  onOpenChange,
}: EditQuestionDialogProps) {
  const [formData, setFormData] = useState({
    question: "",
    imageSrc: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    explanation: "",
    references: [""],
    objectifCMC: "",
    domain: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  const updateQuestion = useMutation(api.questions.updateQuestion)
  const allDomains = useQuery(api.questions.getAllDomains)

  // Charger les données de la question quand le dialog s'ouvre
  useEffect(() => {
    if (question && open) {
      setFormData({
        question: question.question,
        imageSrc: question.imageSrc || "",
        options: [...question.options],
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        references:
          question.references && question.references.length > 0
            ? [...question.references]
            : [""],
        objectifCMC: question.objectifCMC,
        domain: question.domain,
      })
    }
  }, [question, open])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData((prev) => ({
      ...prev,
      options: newOptions,
    }))

    // Si cette option était la réponse correcte, mettre à jour la réponse correcte
    if (formData.correctAnswer === formData.options[index]) {
      setFormData((prev) => ({
        ...prev,
        correctAnswer: value,
      }))
    }
  }

  const handleReferenceChange = (index: number, value: string) => {
    const newReferences = [...formData.references]
    newReferences[index] = value
    setFormData((prev) => ({
      ...prev,
      references: newReferences,
    }))
  }

  const addReference = () => {
    setFormData((prev) => ({
      ...prev,
      references: [...prev.references, ""],
    }))
  }

  const removeReference = (index: number) => {
    if (formData.references.length > 1) {
      const newReferences = formData.references.filter((_, i) => i !== index)
      setFormData((prev) => ({
        ...prev,
        references: newReferences,
      }))
    }
  }

  const validateForm = (): string | null => {
    if (!formData.question.trim()) return "La question est requise"
    if (formData.options.some((opt) => !opt.trim()))
      return "Toutes les options sont requises"
    if (!formData.correctAnswer.trim()) return "La réponse correcte est requise"
    if (!formData.explanation.trim()) return "L'explication est requise"
    if (!formData.objectifCMC.trim()) return "L'objectif CMC est requis"
    if (!formData.domain) return "Le domaine est requis"
    if (!formData.options.includes(formData.correctAnswer))
      return "La réponse correcte doit correspondre à une des options"
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const error = validateForm()
    if (error) {
      toast.error(error)
      return
    }

    if (!question) return

    setIsLoading(true)
    try {
      // Filtrer les références vides
      const filteredReferences = formData.references.filter(
        (ref) => ref.trim() !== "",
      )

      const updateData = {
        id: question._id as Id<"questions">,
        question: formData.question,
        imageSrc: formData.imageSrc || undefined,
        options: formData.options,
        correctAnswer: formData.correctAnswer,
        explanation: formData.explanation,
        references:
          filteredReferences.length > 0 ? filteredReferences : undefined,
        objectifCMC: formData.objectifCMC,
        domain: formData.domain,
      }

      await updateQuestion({
        ...updateData,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        domain: updateData.domain as any,
      })
      toast.success("Question modifiée avec succès !")
      onOpenChange(false)
    } catch (error) {
      console.error("Erreur lors de la modification:", error)
      toast.error("Erreur lors de la modification de la question")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la question</DialogTitle>
          <DialogDescription>
            Modifiez les informations de la question ci-dessous.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question */}
          <div className="space-y-2">
            <Label htmlFor="question">
              Question <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="question"
              placeholder="Saisissez votre question ici..."
              value={formData.question}
              onChange={(e) => handleInputChange("question", e.target.value)}
              className="min-h-[100px]"
              required
            />
          </div>

          {/* Image (optionnelle) */}
          <div className="space-y-2">
            <Label htmlFor="imageSrc">URL de l&apos;image (optionnel)</Label>
            <Input
              id="imageSrc"
              type="url"
              placeholder="https://exemple.com/image.jpg"
              value={formData.imageSrc}
              onChange={(e) => handleInputChange("imageSrc", e.target.value)}
            />
          </div>

          {/* Options de réponse */}
          <div className="space-y-4">
            <Label>
              Options de réponse <span className="text-red-500">*</span>
            </Label>
            {formData.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <Badge
                  variant={
                    formData.correctAnswer === option ? "default" : "outline"
                  }
                  className="flex h-6 min-w-[24px] cursor-pointer items-center justify-center"
                  onClick={() =>
                    option.trim() && handleInputChange("correctAnswer", option)
                  }
                >
                  {String.fromCharCode(65 + index)}
                </Badge>
                <Input
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className={
                    formData.correctAnswer === option ? "border-green-400" : ""
                  }
                  required
                />
                {formData.correctAnswer === option && (
                  <Check className="h-5 w-5 text-green-600" />
                )}
              </div>
            ))}
            <p className="text-xs text-gray-500">
              Cliquez sur la lettre (A, B, C, D) pour sélectionner la bonne
              réponse
            </p>
          </div>

          {/* Domaine et Objectif CMC */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="domain">
                Domaine <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.domain}
                onValueChange={(value) => handleInputChange("domain", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un domaine" />
                </SelectTrigger>
                <SelectContent>
                  {allDomains?.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectifCMC">
                Objectif CMC <span className="text-red-500">*</span>
              </Label>
              <Input
                id="objectifCMC"
                placeholder="Ex: Blessure abdominale"
                value={formData.objectifCMC}
                onChange={(e) =>
                  handleInputChange("objectifCMC", e.target.value)
                }
                required
              />
            </div>
          </div>

          {/* Explication */}
          <div className="space-y-2">
            <Label htmlFor="explanation">
              Explication <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="explanation"
              placeholder="Explication détaillée de la réponse..."
              value={formData.explanation}
              onChange={(e) => handleInputChange("explanation", e.target.value)}
              className="min-h-[150px]"
              required
            />
          </div>

          {/* Références */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Références</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addReference}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
            {formData.references.map((reference, index) => (
              <div key={index} className="flex items-start space-x-2">
                <Badge
                  variant="outline"
                  className="mt-2 flex h-6 min-w-[32px] items-center justify-center"
                >
                  {index + 1}
                </Badge>
                <Textarea
                  placeholder="Référence bibliographique complète..."
                  value={reference}
                  onChange={(e) => handleReferenceChange(index, e.target.value)}
                  className="min-h-[80px]"
                />
                {formData.references.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeReference(index)}
                    className="mt-2 text-red-600 hover:text-red-700"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Modification..." : "Modifier la question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
