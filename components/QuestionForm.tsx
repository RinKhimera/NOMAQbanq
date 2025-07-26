"use client"

import { useMutation, useQuery } from "convex/react"
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Doc } from "@/convex/_generated/dataModel"

// Type basé sur Doc<"questions"> mais sans les champs de métadonnées
// et avec references toujours défini pour le formulaire
type QuestionFormData = Omit<
  Doc<"questions">,
  "_id" | "_creationTime" | "references"
> & {
  references: string[]
}

export default function QuestionForm() {
  const [formData, setFormData] = useState<QuestionFormData>({
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
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createQuestion = useMutation(api.questions.createQuestion)
  const uniqueDomains = useQuery(api.questions.getUniqueDomains)

  const handleInputChange = (
    field: keyof QuestionFormData,
    value: string | number,
  ) => {
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

  const resetForm = () => {
    setFormData({
      question: "",
      imageSrc: "",
      options: ["", "", "", ""],
      correctAnswer: "",
      explanation: "",
      references: [""],
      objectifCMC: "",
      domain: "",
    })
    setSuccess(false)
    setError(null)
  }

  const validateForm = (): string | null => {
    if (!formData.question.trim()) return "La question est obligatoire"
    if (formData.options.some((opt) => !opt.trim()))
      return "Toutes les options doivent être remplies"
    if (!formData.explanation.trim()) return "L'explication est obligatoire"
    if (!formData.objectifCMC.trim()) return "L'objectif CMC est obligatoire"
    if (!formData.domain) return "Le domaine est obligatoire"
    if (
      !formData.correctAnswer ||
      !formData.options.includes(formData.correctAnswer)
    )
      return "Vous devez sélectionner une réponse correcte parmi les options"
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setSuccess(false)

      // Filtrer les références vides
      const filteredReferences = formData.references.filter(
        (ref) => ref.trim() !== "",
      )

      await createQuestion({
        question: formData.question,
        imageSrc: formData.imageSrc || undefined,
        options: formData.options,
        correctAnswer: formData.correctAnswer,
        explanation: formData.explanation,
        references:
          filteredReferences.length > 0 ? filteredReferences : undefined,
        objectifCMC: formData.objectifCMC,
        domain: formData.domain,
      })

      setSuccess(true)
      console.log("Question ajoutée avec succès !")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'ajout de la question",
      )
      console.error("Erreur:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-6 w-6" />
            Ajouter une nouvelle question
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Question */}
            <div className="space-y-2">
              <Label htmlFor="question" className="text-sm font-semibold">
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
              <Label htmlFor="imageSrc" className="text-sm font-semibold">
                URL de l&apos;image (optionnel)
              </Label>
              <Input
                id="imageSrc"
                type="url"
                placeholder="https://exemple.com/image.jpg"
                value={formData.imageSrc}
                onChange={(e) => handleInputChange("imageSrc", e.target.value)}
              />
            </div>

            {/* Options */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold">
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
                      option.trim() &&
                      handleInputChange("correctAnswer", option)
                    }
                  >
                    {String.fromCharCode(65 + index)}
                  </Badge>
                  <Input
                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    value={option}
                    onChange={(e) => {
                      const newValue = e.target.value
                      handleOptionChange(index, newValue)
                      // Si c'était la réponse correcte, mettre à jour avec la nouvelle valeur
                      if (formData.correctAnswer === option) {
                        handleInputChange("correctAnswer", newValue)
                      }
                    }}
                    className={
                      formData.correctAnswer === option
                        ? "border-green-400"
                        : ""
                    }
                    required
                  />
                  {formData.correctAnswer === option && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
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
                <Label htmlFor="domain" className="text-sm font-semibold">
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
                    {uniqueDomains?.map((domain) => (
                      <SelectItem key={domain} value={domain}>
                        {domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="objectifCMC" className="text-sm font-semibold">
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
              <Label htmlFor="explanation" className="text-sm font-semibold">
                Explication <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="explanation"
                placeholder="Explication détaillée de la réponse..."
                value={formData.explanation}
                onChange={(e) =>
                  handleInputChange("explanation", e.target.value)
                }
                className="min-h-[150px]"
                required
              />
              <p className="text-xs text-gray-500">
                Vous pouvez utiliser des sauts de ligne. Les références peuvent
                être citées avec [1], [2], etc.
              </p>
            </div>

            {/* Références */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Références</Label>
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
                    onChange={(e) =>
                      handleReferenceChange(index, e.target.value)
                    }
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

            {/* Messages d'erreur et de succès */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Question ajoutée avec succès !</span>
              </div>
            )}

            {/* Boutons */}
            <div className="flex flex-col gap-4 pt-6 sm:flex-row">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ajout en cours...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Ajouter la question
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={isLoading}
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Réinitialiser
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
