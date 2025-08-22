"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import {
  CheckCircle,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MEDICAL_DOMAINS } from "@/constants"
import { api } from "@/convex/_generated/api"
import {
  QuestionFormValues,
  filterValidOptions,
  filterValidReferences,
  questionFormSchema,
  validateCorrectAnswer,
} from "@/schemas"

export default function QuestionForm() {
  const [references, setReferences] = useState<string[]>([""])
  const [options, setOptions] = useState<string[]>(["", "", "", "", ""])

  const createQuestion = useMutation(api.questions.createQuestion)

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      question: "",
      imageSrc: "",
      options: ["", "", "", "", ""],
      correctAnswer: "",
      explanation: "",
      references: [""],
      objectifCMC: "",
      domain: "",
    },
  })

  const addReference = () => {
    const newReferences = [...references, ""]
    setReferences(newReferences)
    form.setValue("references", newReferences)
  }

  const removeReference = (index: number) => {
    if (references.length > 1) {
      const newReferences = references.filter((_, i) => i !== index)
      setReferences(newReferences)
      form.setValue("references", newReferences)
    }
  }

  const updateReference = (index: number, value: string) => {
    const newReferences = [...references]
    newReferences[index] = value
    setReferences(newReferences)
    form.setValue("references", newReferences)
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
    form.setValue("options", newOptions)

    // Si c'était la réponse correcte, mettre à jour
    if (form.getValues("correctAnswer") === options[index]) {
      form.setValue("correctAnswer", value)
    }
  }

  const resetForm = () => {
    form.reset()
    setReferences([""])
    setOptions(["", "", "", "", ""])
  }

  const onSubmit = async (values: QuestionFormValues) => {
    try {
      // Utiliser les helpers pour la validation et le filtrage
      const filteredOptions = filterValidOptions(values.options)
      if (filteredOptions.length < 4) {
        toast.error("Au moins 4 options sont requises")
        return
      }

      // Vérifier que la réponse correcte est dans les options
      if (!validateCorrectAnswer(values)) {
        toast.error("La réponse correcte doit être l'une des options")
        return
      }

      const filteredReferences = filterValidReferences(references)

      await createQuestion({
        question: values.question,
        imageSrc: values.imageSrc || undefined,
        options: filteredOptions,
        correctAnswer: values.correctAnswer,
        explanation: values.explanation,
        references: filteredReferences,
        objectifCMC: values.objectifCMC,
        domain: values.domain,
      })

      toast.success("Question ajoutée avec succès !")
      resetForm()
    } catch (error) {
      toast.error("Erreur lors de l'ajout de la question")
      console.error("Erreur:", error)
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Question */}
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Question <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Saisissez votre question ici..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Image (optionnelle) */}
              <FormField
                control={form.control}
                name="imageSrc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de l&apos;image (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://exemple.com/image.jpg"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Options */}
              <FormField
                control={form.control}
                name="options"
                render={() => (
                  <FormItem>
                    <FormLabel>
                      Options de réponse <span className="text-red-500">*</span>
                    </FormLabel>
                    <div className="space-y-3">
                      {options.map((option, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3"
                        >
                          <Badge
                            variant={
                              form.watch("correctAnswer") === option
                                ? "default"
                                : "outline"
                            }
                            className="flex h-6 min-w-[24px] cursor-pointer items-center justify-center"
                            onClick={() =>
                              option.trim() &&
                              form.setValue("correctAnswer", option)
                            }
                          >
                            {String.fromCharCode(65 + index)}
                          </Badge>
                          <Input
                            placeholder={`Option ${String.fromCharCode(65 + index)}`}
                            value={option}
                            onChange={(e) =>
                              updateOption(index, e.target.value)
                            }
                            className={
                              form.watch("correctAnswer") === option
                                ? "border-green-400"
                                : ""
                            }
                            disabled={
                              index > 3 &&
                              options.slice(0, 4).some((opt) => !opt.trim())
                            }
                          />
                          {form.watch("correctAnswer") === option && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                      ))}
                    </div>
                    <FormDescription>
                      Cliquez sur la lettre (A, B, C, D, E) pour sélectionner la
                      bonne réponse. Minimum 4 options, maximum 5.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Domaine et Objectif CMC */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Domaine <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un domaine" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MEDICAL_DOMAINS?.map((domain) => (
                            <SelectItem key={domain} value={domain}>
                              {domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="objectifCMC"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Objectif CMC <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Blessure abdominale"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Explication */}
              <FormField
                control={form.control}
                name="explanation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Explication <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Explication détaillée de la réponse..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Vous pouvez utiliser des sauts de ligne. Les références
                      peuvent être citées avec [1], [2], etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Références */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-semibold">
                    Références
                  </FormLabel>
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
                {references.map((reference, index) => (
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
                      onChange={(e) => updateReference(index, e.target.value)}
                      className="min-h-[80px]"
                    />
                    {references.length > 1 && (
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

              {/* Boutons */}
              <div className="flex flex-col gap-4 pt-6 sm:flex-row">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {form.formState.isSubmitting ? (
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
                  disabled={form.formState.isSubmitting}
                  className="flex-1"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Réinitialiser
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
