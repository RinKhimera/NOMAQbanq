"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronsUpDown,
  Clock,
  Coffee,
  FileText,
  Info,
  Sparkles,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { QuestionSelector } from "@/components/admin/question-selector"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import {
  DEFAULT_PAUSE_DURATION_MINUTES,
  ExamFormValues,
  examFormSchema,
  getDefaultPauseDuration,
  validateQuestionCount,
} from "@/schemas"

const AdminCreateExamPage = () => {
  const router = useRouter()
  const [selectedQuestions, setSelectedQuestions] = useState<Id<"questions">[]>(
    [],
  )
  const [selectedParticipants, setSelectedParticipants] = useState<
    Id<"users">[]
  >([])

  const createExam = useMutation(api.exams.createExam)
  const users = useQuery(api.users.getAllUsers)

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      title: "",
      description: "",
      numberOfQuestions: 10,
      questionIds: [],
      enablePause: false,
      pauseDurationMinutes: DEFAULT_PAUSE_DURATION_MINUTES,
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

  const onSubmit = async (values: ExamFormValues) => {
    try {
      if (!values.startDate || !values.endDate) {
        toast.error("Veuillez sélectionner les dates de début et de fin")
        return
      }

      if (!validateQuestionCount(selectedQuestions, values.numberOfQuestions)) {
        toast.error(
          `Veuillez sélectionner exactement ${values.numberOfQuestions} questions`,
        )
        return
      }

      const startDate = values.startDate.getTime()
      const endDate = values.endDate.getTime()

      await createExam({
        title: values.title,
        description: values.description,
        startDate,
        endDate,
        questionIds: selectedQuestions,
        allowedParticipants: selectedParticipants,
        enablePause: values.enablePause,
        pauseDurationMinutes: values.enablePause
          ? values.pauseDurationMinutes
          : undefined,
      })

      toast.success("Examen créé avec succès")
      router.push("/admin/exams")
    } catch (error) {
      toast.error("Erreur lors de la création de l'examen")
      console.error(error)
    }
  }

  const handleQuestionSelectionChange = (questions: Id<"questions">[]) => {
    setSelectedQuestions(questions)
    form.setValue("questionIds", questions)
  }

  // Handle pause toggle - set default duration when enabling
  const handlePauseToggle = (checked: boolean) => {
    form.setValue("enablePause", checked)
    if (checked) {
      const defaultDuration = getDefaultPauseDuration(numberOfQuestions)
      form.setValue("pauseDurationMinutes", defaultDuration || 15)
    }
  }

  // Calculate estimated exam duration
  const estimatedDuration = Math.ceil((numberOfQuestions * 83) / 60)

  return (
    <div className="@container min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 @md:flex-row @md:items-center @md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Créer un examen
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Configurez une nouvelle session d&apos;évaluation
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-fit border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            asChild
          >
            <Link href="/admin/exams">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux examens
            </Link>
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Main Info Card */}
            <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
              <CardHeader className="border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <CardTitle className="text-lg">
                    Informations générales
                  </CardTitle>
                </div>
                <CardDescription className="text-blue-100">
                  Définissez le titre, la période et le nombre de questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="grid gap-6 @lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 dark:text-gray-300">
                          Titre de l&apos;examen
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Examen de Cardiologie - Session 2025"
                            className="border-gray-200 bg-white focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numberOfQuestions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 dark:text-gray-300">
                          Nombre de questions
                        </FormLabel>
                        <div className="flex items-center gap-3">
                          <FormControl>
                            <Input
                              type="number"
                              min={10}
                              max={230}
                              className="border-gray-200 bg-white focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
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
                </div>

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field: startField }) => (
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field: endField }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-300">
                            Période de disponibilité
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start border-gray-200 bg-white text-left font-normal hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700",
                                    !startField.value &&
                                      "text-muted-foreground",
                                  )}
                                >
                                  <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                                  {startField.value && endField.value ? (
                                    <span className="text-gray-900 dark:text-white">
                                      {format(startField.value, "d MMM yyyy", {
                                        locale: fr,
                                      })}{" "}
                                      →{" "}
                                      {format(endField.value, "d MMM yyyy", {
                                        locale: fr,
                                      })}
                                    </span>
                                  ) : (
                                    <span>Sélectionner les dates...</span>
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
                            Les candidats pourront accéder à l&apos;examen
                            pendant cette période
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 dark:text-gray-300">
                        Description{" "}
                        <span className="text-gray-400">(optionnel)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ajoutez des instructions ou informations supplémentaires..."
                          rows={3}
                          className="resize-none border-gray-200 bg-white focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Pause Settings Card */}
            <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
              <CardHeader className="border-b bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <div className="flex items-center gap-2">
                  <Coffee className="h-5 w-5" />
                  <CardTitle className="text-lg">
                    Pause pendant l&apos;examen
                  </CardTitle>
                </div>
                <CardDescription className="text-amber-100">
                  Permettez aux candidats de prendre une pause obligatoire
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <FormField
                  control={form.control}
                  name="enablePause"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                      <div className="space-y-1">
                        <FormLabel className="text-base font-medium text-gray-900 dark:text-white">
                          Activer la pause obligatoire
                        </FormLabel>
                        <FormDescription className="text-sm text-gray-500">
                          Une pause sera imposée à mi-parcours de l&apos;examen
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={handlePauseToggle}
                          className="data-[state=checked]:bg-amber-500"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {enablePause && (
                  <div className="animate-in fade-in-0 slide-in-from-top-2 space-y-4">
                    <FormField
                      control={form.control}
                      name="pauseDurationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-300">
                            Durée de la pause
                          </FormLabel>
                          <div className="flex items-center gap-3">
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={60}
                                className="w-32 border-gray-200 bg-white focus:border-amber-500 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-800"
                                value={field.value || ""}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 15
                                  field.onChange(
                                    Math.min(60, Math.max(1, value)),
                                  )
                                }}
                              />
                            </FormControl>
                            <span className="text-sm text-gray-500">
                              minutes
                            </span>
                          </div>
                          <FormDescription className="text-xs">
                            Le candidat peut écourter la pause s&apos;il le
                            souhaite (1-60 min)
                          </FormDescription>
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
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <span>
                            <strong>Avant la pause :</strong> Seules les
                            questions 1 à {Math.ceil(numberOfQuestions / 2)}{" "}
                            sont accessibles
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <span>
                            <strong>Pendant la pause :</strong> Toutes les
                            questions sont verrouillées
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
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
              </CardContent>
            </Card>

            {/* Participants Card */}
            <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
              <CardHeader className="border-b bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <CardTitle className="text-lg">Participants</CardTitle>
                </div>
                <CardDescription className="text-emerald-100">
                  Sélectionnez les utilisateurs autorisés à passer cet examen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
                        selectedParticipants.length === 0 &&
                          "text-muted-foreground",
                      )}
                    >
                      {selectedParticipants.length === 0
                        ? "Sélectionner les participants..."
                        : `${selectedParticipants.length} participant(s) sélectionné(s)`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher un utilisateur..." />
                      <CommandEmpty>Aucun utilisateur trouvé.</CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="h-64">
                          {users
                            ?.filter((user) => user.role !== "admin")
                            .map((user) => (
                              <CommandItem
                                key={user._id}
                                onSelect={() => {
                                  if (selectedParticipants.includes(user._id)) {
                                    setSelectedParticipants(
                                      selectedParticipants.filter(
                                        (id) => id !== user._id,
                                      ),
                                    )
                                  } else {
                                    setSelectedParticipants([
                                      ...selectedParticipants,
                                      user._id,
                                    ])
                                  }
                                }}
                              >
                                <div className="flex w-full items-center gap-3">
                                  <Checkbox
                                    checked={selectedParticipants.includes(
                                      user._id,
                                    )}
                                    onCheckedChange={() => {}}
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium">{user.name}</p>
                                    <p className="text-muted-foreground text-xs">
                                      {user.email}
                                    </p>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                        </ScrollArea>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>

                {selectedParticipants.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedParticipants.map((participantId) => {
                      const user = users?.find((u) => u._id === participantId)
                      return user ? (
                        <Badge
                          key={participantId}
                          variant="secondary"
                          className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                        >
                          {user.name}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParticipants(
                                selectedParticipants.filter(
                                  (id) => id !== participantId,
                                ),
                              )
                            }}
                            className="ml-1 rounded-full hover:bg-emerald-300 dark:hover:bg-emerald-700"
                          >
                            ×
                          </button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  💡 Les administrateurs peuvent toujours accéder à tous les
                  examens
                </p>
              </CardContent>
            </Card>

            {/* Questions Card */}
            <Card className="overflow-hidden border-0 shadow-xl shadow-gray-200/50 dark:shadow-none">
              <CardHeader className="border-b bg-gradient-to-r from-violet-500 to-purple-500 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <CardTitle className="text-lg">
                      Questions de l&apos;examen
                    </CardTitle>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "font-mono",
                      selectedQuestions.length === numberOfQuestions
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-white/20 text-white",
                    )}
                  >
                    {selectedQuestions.length} / {numberOfQuestions}
                  </Badge>
                </div>
                <CardDescription className="text-violet-100">
                  Sélectionnez exactement {numberOfQuestions} questions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
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

            {/* Action Footer */}
            <div className="sticky bottom-4 z-10">
              <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-gray-800/80">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="text-sm text-gray-500">
                    {selectedQuestions.length === numberOfQuestions ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Prêt à créer
                      </span>
                    ) : (
                      <span>
                        Sélectionnez encore{" "}
                        {numberOfQuestions - selectedQuestions.length}{" "}
                        question(s)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/admin/exams")}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={selectedQuestions.length !== numberOfQuestions}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Créer l&apos;examen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default AdminCreateExamPage
