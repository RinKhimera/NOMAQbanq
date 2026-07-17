"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  ArrowLeft,
  Calendar,
  CircleCheck,
  Clock,
  Coffee,
  FileText,
  Info,
  LoaderCircle,
  Save,
  Sparkles,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import {
  QuestionBrowser,
  QuestionPreviewPanel,
} from "@/components/admin/question-browser"
import { UserMultiSelect } from "@/components/admin/user-multi-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createExam, updateExam } from "@/features/exams/actions"
import type {
  EligibleCandidate,
  ExamPickerOption,
  ExamWithQuestions,
} from "@/features/exams/dal"
import type { SelectableUser } from "@/features/users/dal"
import { callAction } from "@/lib/safe-action"
import { cn } from "@/lib/utils"
import {
  DEFAULT_PAUSE_DURATION_MINUTES,
  ExamFormValues,
  examFormSchema,
  getDefaultPauseDuration,
  validateQuestionCount,
} from "@/schemas"
import { AudienceEligibility } from "./audience-eligibility"

/**
 * Formulaire d'examen unifié (fusion exam-create-form / exam-edit-form,
 * ≈ 68 % identiques — C6 #113). Le `mode` pilote les données initiales,
 * l'action serveur et les libellés ; le markup est unique.
 */
type ExamFormProps =
  | {
      mode: "create"
      candidates: EligibleCandidate[]
      examOptions: ExamPickerOption[]
    }
  | {
      mode: "edit"
      examId: string
      exam: NonNullable<ExamWithQuestions>["exam"]
      /** IDs des questions de l'examen, ordonnés par position (forme « pont »). */
      questionIds: string[]
      candidates: EligibleCandidate[]
      /** Audience restreinte pré-remplie (vide si `audienceType === "subscribers"`). */
      initialAudience: SelectableUser[]
    }

const MODE_COPY = {
  create: {
    title: "Créer un examen",
    subtitle: "Configurez une nouvelle session d'évaluation",
    submitLabel: "Créer l'examen",
    submittingLabel: "Création...",
    readyLabel: "Prêt à créer",
    successMessage: "Examen créé avec succès",
    errorMessage: "Erreur lors de la création de l'examen",
  },
  edit: {
    title: "Modifier l'examen",
    subtitle: "Mettez à jour les paramètres de votre examen",
    submitLabel: "Modifier l'examen",
    submittingLabel: "Modification...",
    readyLabel: "Prêt à enregistrer",
    successMessage: "Examen modifié avec succès",
    errorMessage: "Erreur lors de la modification de l'examen",
  },
} as const

export function ExamForm(props: ExamFormProps) {
  const router = useRouter()
  const copy = MODE_COPY[props.mode]
  const SubmitIcon = props.mode === "create" ? Sparkles : Save

  // Les données viennent du Server Component (props) → initialisation synchrone.
  const initialQuestionIds = props.mode === "edit" ? props.questionIds : []
  const initialAudience = props.mode === "edit" ? props.initialAudience : []
  const [selectedQuestions, setSelectedQuestions] =
    useState<string[]>(initialQuestionIds)
  const [selectedUsers, setSelectedUsers] =
    useState<SelectableUser[]>(initialAudience)

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues:
      props.mode === "edit"
        ? {
            title: props.exam.title,
            description: props.exam.description ?? "",
            numberOfQuestions: props.exam.questionCount,
            startDate: new Date(props.exam.startDate),
            endDate: new Date(props.exam.endDate),
            questionIds: initialQuestionIds,
            enablePause: props.exam.enablePause,
            pauseDurationMinutes: props.exam.pauseDurationMinutes ?? 15,
            audienceType: props.exam.audienceType,
            audienceUserIds: initialAudience.map((u) => u.id),
          }
        : {
            title: "",
            description: "",
            numberOfQuestions: 10,
            questionIds: [],
            enablePause: false,
            pauseDurationMinutes: DEFAULT_PAUSE_DURATION_MINUTES,
            audienceType: "subscribers",
            audienceUserIds: [],
          },
  })

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

  const audienceType = useWatch({
    control: form.control,
    name: "audienceType",
  })

  // Durée estimée de l'examen (83 secondes par question).
  const estimatedDuration = Math.ceil((numberOfQuestions * 83) / 60)

  const handleAudienceUsersChange = (next: SelectableUser[]) => {
    setSelectedUsers(next)
    form.setValue(
      "audienceUserIds",
      next.map((u) => u.id),
      { shouldValidate: true },
    )
  }

  const handleQuestionSelectionChange = (ids: string[]) => {
    setSelectedQuestions(ids)
    form.setValue("questionIds", ids)
  }

  const handleEnablePauseChange = (checked: boolean) => {
    form.setValue("enablePause", checked)
    if (checked && !pauseDurationMinutes) {
      form.setValue(
        "pauseDurationMinutes",
        getDefaultPauseDuration(numberOfQuestions) || 15,
      )
    }
  }

  const onSubmit = async (values: ExamFormValues) => {
    if (!values.startDate || !values.endDate) {
      toast.error("Veuillez sélectionner les dates de début et de fin")
      return
    }

    const questionsToValidate =
      selectedQuestions.length > 0 ? selectedQuestions : values.questionIds

    if (!validateQuestionCount(questionsToValidate, values.numberOfQuestions)) {
      toast.error(
        `Veuillez sélectionner exactement ${values.numberOfQuestions} questions`,
      )
      return
    }

    const payload = {
      title: values.title,
      description: values.description,
      startDate: values.startDate.getTime(),
      endDate: values.endDate.getTime(),
      questionIds: questionsToValidate,
      enablePause: values.enablePause ?? false,
      pauseDurationMinutes: values.enablePause
        ? values.pauseDurationMinutes
        : undefined,
      audienceType: values.audienceType,
      audienceUserIds:
        values.audienceType === "restricted" ? values.audienceUserIds : [],
    }

    // Deux appels séparés (pas un ternaire DANS callAction) : TS infère sinon
    // l'union des retours createExam/updateExam et refuse l'assignation.
    const result =
      props.mode === "edit"
        ? await callAction(() => updateExam({ id: props.examId, ...payload }))
        : await callAction(() => createExam(payload))

    if (!result.success) {
      toast.error(("error" in result && result.error) || copy.errorMessage)
      return
    }

    toast.success(copy.successMessage)
    router.push("/admin/examens")
  }

  return (
    <div className="@container flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 @lg:flex-row @lg:items-center">
        <div className="space-y-1">
          <h1 className="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-blue-400 dark:to-indigo-400">
            {copy.title}
          </h1>
          <p className="text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="group w-fit transition-all hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-700 dark:hover:bg-blue-950"
          asChild
        >
          <Link href="/admin/examens">
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
              <CardHeader className="bg-linear-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20">
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
                          placeholder="Ex: Examen de Cardiologie - Session 2025"
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
                        <div className="flex items-center gap-3">
                          <FormControl>
                            <Input
                              type="number"
                              min={10}
                              max={230}
                              placeholder="Entre 10 et 230"
                              className="transition-all focus:ring-2 focus:ring-blue-500/20"
                              value={field.value || ""}
                              onChange={(e) => {
                                const numValue = parseInt(e.target.value) || 10
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
                          <Badge
                            variant="secondary"
                            className="shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            <Clock className="mr-1 h-3 w-3" />~
                            {estimatedDuration} min
                          </Badge>
                        </div>
                        <FormDescription className="text-xs">
                          Entre 10 et 230 questions (83 secondes par question)
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
                              Période de disponibilité
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
                                        {format(
                                          startField.value,
                                          "d MMM yyyy",
                                          { locale: fr },
                                        )}{" "}
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
              <CardHeader className="bg-linear-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 shadow-md">
                    <Coffee className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-amber-700 dark:text-amber-300">
                      Pause pendant l&apos;examen
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

                    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                      <Info className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-900 dark:text-amber-100">
                        Comment fonctionne la pause ?
                      </AlertTitle>
                      <AlertDescription className="mt-2 space-y-2 text-sm text-amber-800 dark:text-amber-200">
                        <div className="flex items-start gap-2">
                          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <span>
                            <strong>Avant la pause :</strong> Seules les
                            questions 1 à {Math.ceil(numberOfQuestions / 2)}{" "}
                            sont accessibles
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <span>
                            <strong>Pendant la pause :</strong> Toutes les
                            questions sont verrouillées
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <span>
                            <strong>Après la pause :</strong> Toutes les{" "}
                            {numberOfQuestions} questions sont déverrouillées
                          </span>
                        </div>
                        <Separator className="my-2 bg-amber-200 dark:bg-amber-700" />
                        <p className="text-xs italic">
                          💡 La pause se déclenche automatiquement à 50% du
                          temps, ou peut être prise manuellement. Le candidat ne
                          peut prendre qu&apos;une seule pause.
                        </p>
                      </AlertDescription>
                    </Alert>
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

          {/* Carte audience */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="bg-linear-to-r from-teal-500/10 to-cyan-500/10 dark:from-teal-500/20 dark:to-cyan-500/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 shadow-md">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-teal-700 dark:text-teal-300">
                    À qui s&apos;adresse cet examen ?
                  </CardTitle>
                  <CardDescription>
                    Choisissez l&apos;audience de cet examen
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <FormField
                control={form.control}
                name="audienceType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="gap-3"
                      >
                        <label
                          htmlFor={`${props.mode}-audience-subscribers`}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                            field.value === "subscribers"
                              ? "border-teal-300 bg-teal-50/50 dark:border-teal-700 dark:bg-teal-900/20"
                              : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
                          )}
                        >
                          <RadioGroupItem
                            value="subscribers"
                            id={`${props.mode}-audience-subscribers`}
                            className="mt-0.5"
                          />
                          <div className="space-y-0.5">
                            <p className="font-medium text-gray-900 dark:text-white">
                              Tous les abonnés aux examens blancs
                            </p>
                            <p className="text-sm text-gray-500">
                              Visible et accessible par tout utilisateur avec un
                              accès examen actif
                            </p>
                          </div>
                        </label>

                        <label
                          htmlFor={`${props.mode}-audience-restricted`}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                            field.value === "restricted"
                              ? "border-teal-300 bg-teal-50/50 dark:border-teal-700 dark:bg-teal-900/20"
                              : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
                          )}
                        >
                          <RadioGroupItem
                            value="restricted"
                            id={`${props.mode}-audience-restricted`}
                            className="mt-0.5"
                          />
                          <div className="space-y-0.5">
                            <p className="font-medium text-gray-900 dark:text-white">
                              Utilisateurs spécifiques
                            </p>
                            <p className="text-sm text-gray-500">
                              Réservé aux utilisateurs choisis (l&apos;accès est
                              octroyé même sans abonnement)
                            </p>
                          </div>
                        </label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {audienceType === "restricted" && (
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="audienceUserIds"
                    render={() => (
                      <FormItem>
                        <FormLabel className="font-medium">
                          Utilisateurs autorisés
                        </FormLabel>
                        <UserMultiSelect
                          value={selectedUsers}
                          onChange={handleAudienceUsersChange}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Résumé contextuel des candidats éligibles (selon la radio). */}
              <AudienceEligibility
                candidates={props.candidates}
                audienceType={audienceType}
                selectedCount={selectedUsers.length}
              />
            </CardContent>
          </Card>

          {/* Questions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Questions de l&apos;examen
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Sélectionnez exactement {numberOfQuestions} questions
                  </p>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="questionIds"
              render={() => (
                <FormItem>
                  <QuestionBrowser
                    mode="select"
                    {...(props.mode === "create"
                      ? { examOptions: props.examOptions }
                      : {})}
                    selectedIds={selectedQuestions}
                    onSelectionChange={handleQuestionSelectionChange}
                    maxSelection={numberOfQuestions}
                    renderPanel={({ questionId, onClose }) => (
                      <QuestionPreviewPanel
                        questionId={questionId}
                        open={!!questionId}
                        onOpenChange={(open) => !open && onClose()}
                      />
                    )}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Footer d'action sticky avec compteur */}
          <div className="sticky bottom-4 z-10">
            <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-gray-800/80">
              <CardContent className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-500">
                  {selectedQuestions.length === numberOfQuestions ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CircleCheck className="h-4 w-4" />
                      {copy.readyLabel}
                    </span>
                  ) : (
                    <span>
                      Sélectionnez encore{" "}
                      {numberOfQuestions - selectedQuestions.length} question(s)
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/admin/examens")}
                    disabled={form.formState.isSubmitting}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      selectedQuestions.length !== numberOfQuestions ||
                      form.formState.isSubmitting
                    }
                    className="bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {form.formState.isSubmitting ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        {copy.submittingLabel}
                      </>
                    ) : (
                      <>
                        <SubmitIcon className="mr-2 h-4 w-4" />
                        {copy.submitLabel}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  )
}
