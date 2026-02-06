"use client"

import { useState, useEffect, startTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  FileText,
  ImageIcon,
  Info,
  Loader2,
  Minus,
  Plus,
  Save,
  Target,
} from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Id } from "@/convex/_generated/dataModel"
import {
  QuestionFormValues,
  filterValidOptions,
  filterValidReferences,
  questionFormSchema,
  validateCorrectAnswer,
} from "@/schemas"
import { cn } from "@/lib/utils"
import { QuestionImageUploader } from "@/components/admin/question-image-uploader"
import { ObjectifCMCCombobox } from "./objectif-cmc-combobox"

interface QuestionImage {
  url: string
  storagePath: string
  order: number
}

interface QuestionFormPageProps {
  mode: "create" | "edit"
  questionId?: Id<"questions">
}

export function QuestionFormPage({ mode, questionId }: QuestionFormPageProps) {
  const router = useRouter()
  const [references, setReferences] = useState<string[]>([""])
  const [options, setOptions] = useState<string[]>(["", "", "", "", ""])
  const [images, setImages] = useState<QuestionImage[]>([])

  // Queries
  const question = useQuery(
    api.questions.getQuestionById,
    mode === "edit" && questionId ? { questionId } : "skip"
  )

  // Mutations
  const createQuestion = useMutation(api.questions.createQuestion)
  const updateQuestion = useMutation(api.questions.updateQuestion)
  const setQuestionImages = useMutation(api.questions.setQuestionImages)

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      question: "",
      options: ["", "", "", "", ""],
      correctAnswer: "",
      explanation: "",
      references: [""],
      objectifCMC: "",
      domain: "",
    },
  })

  const correctAnswer = useWatch({
    control: form.control,
    name: "correctAnswer",
  })

  // Pre-fill form in edit mode
  useEffect(() => {
    if (mode === "edit" && question) {
      const paddedOptions = [
        ...question.options,
        ...Array(5 - question.options.length).fill(""),
      ].slice(0, 5)
      const paddedReferences = question.references?.length ? question.references : [""]

      form.reset({
        question: question.question,
        options: paddedOptions,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        references: paddedReferences,
        objectifCMC: question.objectifCMC,
        domain: question.domain,
      })

      // Batch local state updates as non-urgent
      startTransition(() => {
        setOptions(paddedOptions)
        setReferences(paddedReferences)
        setImages(question.images || [])
      })
    }
  }, [mode, question, form])

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

    // If this was the correct answer, update it
    if (form.getValues("correctAnswer") === options[index]) {
      form.setValue("correctAnswer", value)
    }
  }

  const onSubmit = async (values: QuestionFormValues) => {
    try {
      // Validate options
      const filteredOptions = filterValidOptions(values.options)
      if (filteredOptions.length < 4) {
        toast.error("Au moins 4 options sont requises")
        return
      }

      // Validate correct answer
      if (!validateCorrectAnswer(values)) {
        toast.error("La réponse correcte doit être l'une des options")
        return
      }

      const filteredReferences = filterValidReferences(references)

      if (mode === "create") {
        const newQuestionId = await createQuestion({
          question: values.question,
          options: filteredOptions,
          correctAnswer: values.correctAnswer,
          explanation: values.explanation,
          references: filteredReferences,
          objectifCMC: values.objectifCMC,
          domain: values.domain,
        })

        // Save images if any
        if (images.length > 0) {
          await setQuestionImages({
            questionId: newQuestionId,
            images: images.map((img, idx) => ({
              url: img.url,
              storagePath: img.storagePath,
              order: idx,
            })),
          })
        }

        toast.success("Question créée avec succès !")
        router.push("/admin/questions")
      } else if (mode === "edit" && questionId) {
        await updateQuestion({
          id: questionId,
          question: values.question,
          options: filteredOptions,
          correctAnswer: values.correctAnswer,
          explanation: values.explanation,
          references: filteredReferences,
          objectifCMC: values.objectifCMC,
          domain: values.domain,
        })

        // Update images
        await setQuestionImages({
          questionId,
          images: images.map((img, idx) => ({
            url: img.url,
            storagePath: img.storagePath,
            order: idx,
          })),
        })

        toast.success("Question mise à jour avec succès !")
        router.push("/admin/questions")
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error(
        mode === "create"
          ? "Erreur lors de la création"
          : "Erreur lors de la mise à jour"
      )
    }
  }

  // Loading state for edit mode
  if (mode === "edit" && question === undefined) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Not found state for edit mode
  if (mode === "edit" && question === null) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-500">Question non trouvée</p>
        <Link href="/admin/questions">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Question Text & Images */}
        <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
          <CardHeader className="border-b bg-linear-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle className="text-lg">Contenu de la question</CardTitle>
            </div>
            <CardDescription className="text-blue-100">
              Saisissez le texte de la question et ajoutez des images si nécessaire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 dark:text-gray-300">
                    Question <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Saisissez votre question ici..."
                      className="min-h-30 resize-none border-gray-200 bg-white focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between">
                    <FormMessage />
                    <span className="text-xs text-gray-400">
                      {field.value?.length || 0} caractères
                    </span>
                  </div>
                </FormItem>
              )}
            />

            <div>
              <div className="mb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-gray-500" />
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Images
                </h4>
                {images.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {images.length}
                  </Badge>
                )}
              </div>
              {mode === "edit" && questionId ? (
                <QuestionImageUploader
                  questionId={questionId}
                  images={images}
                  onImagesChange={setImages}
                />
              ) : (
                <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
                  <ImageIcon className="mx-auto h-10 w-10 text-gray-400" />
                  <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Les images pourront être ajoutées après la création
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    Créez la question, puis modifiez-la pour ajouter des images
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
          <CardHeader className="border-b bg-linear-to-r from-violet-500 to-purple-500 text-white">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <CardTitle className="text-lg">Options de réponse</CardTitle>
            </div>
            <CardDescription className="text-violet-100">
              Saisissez les options et cliquez sur la lettre pour marquer la bonne réponse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <FormField
              control={form.control}
              name="options"
              render={() => (
                <FormItem>
                  <div className="space-y-3">
                    {options.map((option, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            option.trim() &&
                            form.setValue("correctAnswer", option)
                          }
                          disabled={!option.trim()}
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 font-bold transition-all",
                            correctAnswer === option && option.trim()
                              ? "cursor-pointer border-emerald-500 bg-emerald-500 text-white"
                              : option.trim()
                                ? "cursor-pointer border-gray-300 bg-white text-gray-600 hover:border-violet-400 hover:bg-violet-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-600"
                          )}
                        >
                          {correctAnswer === option && option.trim() ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            String.fromCharCode(65 + index)
                          )}
                        </button>
                        <Input
                          placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          className={cn(
                            "border-gray-200 bg-white transition-colors focus:border-violet-500 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-800",
                            correctAnswer === option && option.trim()
                              ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"
                              : ""
                          )}
                        />
                      </div>
                    ))}
                  </div>
                  <FormDescription className="mt-4 text-xs">
                    Cliquez sur la lettre pour marquer la bonne réponse.
                    Minimum 4 options, maximum 5.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Domain & ObjectifCMC */}
        <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
          <CardHeader className="border-b bg-linear-to-r from-emerald-600 to-teal-600 text-white">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle className="text-lg">Classification</CardTitle>
            </div>
            <CardDescription className="text-emerald-100">
              Définissez le domaine médical et l&apos;objectif CMC de la question
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 dark:text-gray-300">
                      Domaine <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-gray-200 bg-white focus:border-emerald-500 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800">
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
                    <FormLabel className="text-gray-700 dark:text-gray-300">
                      Objectif CMC <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <ObjectifCMCCombobox
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Sélectionner ou créer..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Explanation */}
        <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
          <CardHeader className="border-b bg-linear-to-r from-amber-500 to-orange-500 text-white">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              <CardTitle className="text-lg">Explication</CardTitle>
            </div>
            <CardDescription className="text-amber-100">
              Fournissez une explication détaillée de la réponse correcte
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <FormField
              control={form.control}
              name="explanation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 dark:text-gray-300">
                    Texte de l&apos;explication <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explication détaillée de la réponse..."
                      className="min-h-45 resize-none border-gray-200 bg-white focus:border-amber-500 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-800"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Vous pouvez utiliser des sauts de ligne. Les références
                    peuvent être citées avec [1], [2], etc.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* References */}
        <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
          <CardHeader className="border-b bg-linear-to-r from-teal-600 to-cyan-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <CardTitle className="text-lg">Références bibliographiques</CardTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addReference}
                className="gap-1 text-white hover:bg-white/20"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
            <CardDescription className="text-teal-100">
              Ajoutez les sources et références utilisées pour cette question
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {references.map((reference, index) => (
              <div key={index} className="flex items-start gap-3">
                <Badge
                  variant="outline"
                  className="mt-2.5 flex h-7 min-w-8 items-center justify-center border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                >
                  {index + 1}
                </Badge>
                <Textarea
                  placeholder="Référence bibliographique complète..."
                  value={reference}
                  onChange={(e) => updateReference(index, e.target.value)}
                  className="min-h-20 resize-none border-gray-200 bg-white focus:border-teal-500 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800"
                />
                {references.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeReference(index)}
                    className="mt-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action Footer */}
        <div className="sticky bottom-4 z-10">
          <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-gray-800/80">
            <CardContent className="flex items-center justify-between p-4">
              <Link href="/admin/questions">
                <Button type="button" variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Annuler
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="gap-2 bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mode === "create" ? "Création..." : "Enregistrement..."}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {mode === "create"
                      ? "Créer la question"
                      : "Enregistrer les modifications"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  )
}
