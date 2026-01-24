"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Coffee,
  FileText,
  Loader2,
  Save,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { QuestionSelector } from "@/components/admin/question-selector"
import { EligibleCandidatesCard } from "../../_components/eligible-candidates-card"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import {
  ExamFormValues,
  examFormSchema,
  getDefaultPauseDuration,
  validateQuestionCount,
} from "@/schemas"

const AdminEditExamPage = () => {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as Id<"exams">

  const [selectedQuestions, setSelectedQuestions] = useState<Id<"questions">[]>(
    [],
  )
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { isAuthenticated } = useConvexAuth()

  const updateExam = useMutation(api.exams.updateExam)
  const exam = useQuery(
    api.exams.getExamWithQuestions,
    isAuthenticated ? { examId } : "skip",
  )

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      title: "",
      description: "",
      numberOfQuestions: 10,
      questionIds: [],
      enablePause: false,
      pauseDurationMinutes: 15,
    },
  })

  if (exam && !isInitialized) {
    form.reset({
      title: exam.title,
      description: exam.description || "",
      numberOfQuestions: exam.questionIds.length,
      startDate: new Date(exam.startDate),
      endDate: new Date(exam.endDate),
      questionIds: exam.questionIds,
      enablePause: exam.enablePause ?? false,
      pauseDurationMinutes: exam.pauseDurationMinutes ?? 15,
    })
    setSelectedQuestions(exam.questionIds)
    setIsInitialized(true)
  }

  const numberOfQuestions = useWatch({
    control: form.control,
    name: "numberOfQuestions",
  })

  const enablePause = useWatch({
    control: form.control,
    name: "enablePause",
  })

  const pauseDurationMinutes = useWatch({
    control: form.control,
    name: "pauseDurationMinutes",
  })

  const onSubmit = async (values: ExamFormValues) => {
    try {
      setIsSubmitting(true)

      if (!values.startDate || !values.endDate) {
        toast.error("Veuillez sélectionner les dates de début et de fin")
        return
      }

      const questionsToValidate =
        selectedQuestions.length > 0 ? selectedQuestions : values.questionIds

      if (
        !validateQuestionCount(questionsToValidate, values.numberOfQuestions)
      ) {
        toast.error(
          `Veuillez sélectionner exactement ${values.numberOfQuestions} questions`,
        )
        return
      }

      const startDate = values.startDate.getTime()
      const endDate = values.endDate.getTime()

      await updateExam({
        examId,
        title: values.title,
        description: values.description,
        startDate,
        endDate,
        questionIds: questionsToValidate,
        enablePause: values.enablePause,
        pauseDurationMinutes: values.pauseDurationMinutes,
      })

      toast.success("Examen modifié avec succès")
      router.push("/admin/exams")
    } catch (error) {
      toast.error("Erreur lors de la modification de l'examen")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuestionSelectionChange = (questions: Id<"questions">[]) => {
    setSelectedQuestions(questions)
    form.setValue("questionIds", questions)
  }

  const handleEnablePauseChange = (checked: boolean) => {
    form.setValue("enablePause", checked)
    if (checked && !pauseDurationMinutes) {
      form.setValue(
        "pauseDurationMinutes",
        getDefaultPauseDuration(numberOfQuestions),
      )
    }
  }

  if (!exam) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Chargement de l&apos;examen...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="@container flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* En-tête moderne */}
      <div className="flex flex-col justify-between gap-4 @lg:flex-row @lg:items-center">
        <div className="space-y-1">
          <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-blue-400 dark:to-indigo-400">
            Modifier l&apos;examen
          </h1>
          <p className="text-muted-foreground">
            Mettez à jour les paramètres de votre examen
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="group w-fit transition-all hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-700 dark:hover:bg-blue-950"
          asChild
        >
          <Link href="/admin/exams">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Retour aux examens
          </Link>
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 @3xl:grid-cols-2">
            {/* Carte informations principales */}
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-md">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-blue-700 dark:text-blue-300">
                      Informations générales
                    </CardTitle>
                    <CardDescription>
                      Titre, description et période de l&apos;examen
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Titre de l&apos;examen
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Examen de Cardiologie - Février 2025"
                          className="transition-all focus:ring-2 focus:ring-blue-500/20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        Description{" "}
                        <span className="text-muted-foreground font-normal">
                          (optionnel)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Décrivez le contenu et les objectifs de cet examen..."
                          rows={3}
                          className="resize-none transition-all focus:ring-2 focus:ring-blue-500/20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-5 @xl:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="numberOfQuestions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium">
                          Nombre de questions
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={10}
                            max={230}
                            placeholder="Entre 10 et 230"
                            className="transition-all focus:ring-2 focus:ring-blue-500/20"
                            value={field.value || ""}
                            onChange={(e) => {
                              const numValue = parseInt(e.target.value) || 0
                              field.onChange(numValue)
                              if (selectedQuestions.length > numValue) {
                                const newSelection = selectedQuestions.slice(
                                  0,
                                  numValue,
                                )
                                setSelectedQuestions(newSelection)
                                form.setValue("questionIds", newSelection)
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Minimum 10, maximum 230 questions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field: startField }) => (
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field: endField }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="font-medium">
                              Période
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal transition-all hover:border-blue-300 dark:hover:border-blue-700",
                                      (!startField.value || !endField.value) &&
                                        "text-muted-foreground",
                                    )}
                                  >
                                    <Calendar className="mr-2 h-4 w-4 text-blue-600" />
                                    {startField.value && endField.value ? (
                                      <span className="truncate">
                                        {format(startField.value, "d MMM", {
                                          locale: fr,
                                        })}{" "}
                                        -{" "}
                                        {format(endField.value, "d MMM yyyy", {
                                          locale: fr,
                                        })}
                                      </span>
                                    ) : (
                                      <span>Sélectionner</span>
                                    )}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <CalendarComponent
                                  mode="range"
                                  selected={{
                                    from: startField.value,
                                    to: endField.value,
                                  }}
                                  onSelect={(range) => {
                                    startField.onChange(range?.from)
                                    endField.onChange(range?.to)
                                  }}
                                  disabled={(date) => {
                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    return date < today
                                  }}
                                  numberOfMonths={2}
                                  autoFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription className="text-xs">
                              Maximum 14 jours
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Carte paramètres de pause */}
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 shadow-md">
                    <Coffee className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-amber-700 dark:text-amber-300">
                      Paramètres de pause
                    </CardTitle>
                    <CardDescription>
                      Configurez une pause optionnelle à mi-parcours
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <FormField
                  control={form.control}
                  name="enablePause"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium">
                          Activer la pause
                        </FormLabel>
                        <FormDescription className="text-sm">
                          Les candidats pourront prendre une pause à mi-parcours
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={handleEnablePauseChange}
                          className="data-[state=checked]:bg-amber-500"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {enablePause && (
                  <div className="space-y-4 rounded-xl border border-amber-100 bg-white p-4 dark:border-amber-800/50 dark:bg-gray-900/50">
                    <FormField
                      control={form.control}
                      name="pauseDurationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="font-medium">
                              Durée de la pause
                            </FormLabel>
                            <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 dark:bg-amber-900/30">
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                                {field.value} min
                              </span>
                            </div>
                          </div>
                          <FormControl>
                            <Slider
                              min={1}
                              max={60}
                              step={1}
                              value={[field.value || 15]}
                              onValueChange={(value) =>
                                field.onChange(value[0])
                              }
                              className="py-4"
                            />
                          </FormControl>
                          <div className="text-muted-foreground flex justify-between text-xs">
                            <span>1 min</span>
                            <span>60 min</span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                      <p className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
                        Fonctionnement :
                      </p>
                      <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-blue-500" />
                          <span>
                            Avant : {Math.ceil(numberOfQuestions / 2)} premières
                            questions accessibles
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-blue-500" />
                          <span>
                            Pendant : toutes les questions verrouillées
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-blue-500" />
                          <span>
                            Après : toutes les questions déverrouillées
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {!enablePause && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-8 dark:border-gray-700 dark:bg-gray-800/30">
                    <Coffee className="mb-2 h-8 w-8 text-gray-400" />
                    <p className="text-muted-foreground text-center text-sm">
                      La pause est désactivée pour cet examen
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Candidats éligibles (lecture seule) */}
          <EligibleCandidatesCard />

          {/* Sélection des questions */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500 shadow-md">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-violet-700 dark:text-violet-300">
                      Questions de l&apos;examen
                    </CardTitle>
                    <CardDescription>
                      Sélectionnez exactement {numberOfQuestions} questions
                    </CardDescription>
                  </div>
                </div>
                <div className="flex h-9 items-center gap-2 rounded-full bg-violet-100 px-4 dark:bg-violet-900/30">
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    {selectedQuestions.length}
                  </span>
                  <span className="text-sm text-violet-600/70 dark:text-violet-400/70">
                    / {numberOfQuestions}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <FormField
                control={form.control}
                name="questionIds"
                render={() => (
                  <FormItem>
                    <QuestionSelector
                      selectedQuestions={selectedQuestions}
                      onSelectionChange={handleQuestionSelectionChange}
                      maxQuestions={numberOfQuestions}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Boutons d'action */}
          <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/exams")}
              className="transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={
                selectedQuestions.length !== numberOfQuestions || isSubmitting
              }
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Modification...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Modifier l&apos;examen
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default AdminEditExamPage
