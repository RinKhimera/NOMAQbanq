"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowLeft, Calendar, ChevronsUpDown } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { QuestionSelector } from "@/components/admin/question-selector"
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
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import {
  ExamFormValues,
  examFormSchema,
  validateQuestionCount,
} from "@/schemas"

const AdminEditExamPage = () => {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as Id<"exams">

  const [selectedQuestions, setSelectedQuestions] = useState<Id<"questions">[]>(
    [],
  )
  const [selectedParticipants, setSelectedParticipants] = useState<
    Id<"users">[]
  >([])
  const [isInitialized, setIsInitialized] = useState(false)

  const { isAuthenticated } = useConvexAuth()

  const updateExam = useMutation(api.exams.updateExam)
  const users = useQuery(
    api.users.getAllUsers,
    isAuthenticated ? undefined : "skip",
  )
  const exam = useQuery(api.exams.getExamWithQuestions, { examId })

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      title: "",
      description: "",
      numberOfQuestions: 10,
      questionIds: [],
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
    })
    setSelectedQuestions(exam.questionIds)
    setSelectedParticipants(exam.allowedParticipants || [])
    setIsInitialized(true)
  }

  const numberOfQuestions = useWatch({
    control: form.control,
    name: "numberOfQuestions",
  })

  const onSubmit = async (values: ExamFormValues) => {
    try {
      if (!values.startDate || !values.endDate) {
        toast.error("Veuillez sélectionner les dates de début et de fin")
        return
      }

      // Utiliser les questions du state OU du formulaire (priorité au state)
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
        allowedParticipants: selectedParticipants,
      })

      toast.success("Examen modifié avec succès")
      router.push("/admin/exams")
    } catch (error) {
      toast.error("Erreur lors de la modification de l'examen")
      console.error(error)
    }
  }

  const handleQuestionSelectionChange = (questions: Id<"questions">[]) => {
    setSelectedQuestions(questions)
    form.setValue("questionIds", questions)
  }

  if (!exam) {
    return <div>Chargement...</div>
  }

  return (
    <div className="@container flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      {/* En-tête avec bouton retour */}
      <div className="flex flex-col justify-between gap-4 @md:flex-row @md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-blue-600 dark:text-white">
            Modifier l&apos;examen
          </h1>
          <p className="text-muted-foreground">
            Modifiez les paramètres de votre examen
          </p>
        </div>
        <Button
          className="hover:text-blue-700 dark:hover:text-white"
          variant="outline"
          size="sm"
          asChild
        >
          <Link href="/admin/exams">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux examens
          </Link>
        </Button>
      </div>

      {/* Formulaire principal */}
      <Card className="">
        <CardHeader>
          <CardTitle className="text-blue-600 dark:text-white">
            Informations de l&apos;examen
          </CardTitle>
          <CardDescription>
            Sélectionnez la période de l&apos;examen (maximum 14 jours).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid items-start gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre de l&apos;examen</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Examen de Cardiologie - Février 2025"
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
                      <FormLabel>Nombre de questions</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={10}
                          max={230}
                          placeholder="Entre 10 et 230 questions"
                          value={field.value || ""}
                          onChange={(e) => {
                            const numValue = parseInt(e.target.value) || 0
                            field.onChange(numValue)
                            // Réinitialiser la sélection de questions si le nombre change
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field: startField }) => (
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field: endField }) => (
                          <FormItem className="flex w-full flex-col">
                            <FormLabel>Période de l&apos;examen</FormLabel>
                            <Popover>
                              <PopoverTrigger className="w-full" asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={`w-full pl-3 text-left font-normal hover:text-blue-700 dark:text-white ${
                                      (!startField.value || !endField.value) &&
                                      "text-muted-foreground"
                                    }`}
                                  >
                                    {startField.value && endField.value ? (
                                      <>
                                        {format(startField.value, "PPP", {
                                          locale: fr,
                                        })}
                                        {" - "}
                                        {format(endField.value, "PPP", {
                                          locale: fr,
                                        })}
                                      </>
                                    ) : (
                                      <span>
                                        Sélectionner la période de l&apos;examen
                                      </span>
                                    )}
                                    <Calendar className="ml-auto h-4 w-4 opacity-50" />
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
                                    if (range?.from) {
                                      startField.onChange(range.from)
                                      if (range?.to) {
                                        endField.onChange(range.to)
                                      } else {
                                        endField.onChange(undefined)
                                      }
                                    } else {
                                      startField.onChange(undefined)
                                      endField.onChange(undefined)
                                    }
                                  }}
                                  disabled={(date) => {
                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    return (
                                      date < today ||
                                      date < new Date("1900-01-01")
                                    )
                                  }}
                                  numberOfMonths={2}
                                  autoFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              Sélectionnez la période de l&apos;examen (maximum
                              14 jours).
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description de l'examen..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sélection des participants autorisés */}
              <div className="space-y-3">
                <FormLabel>Participants autorisés</FormLabel>
                <FormDescription>
                  Sélectionnez les utilisateurs qui peuvent passer cet examen.
                  Les administrateurs peuvent toujours passer les examens.
                </FormDescription>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
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
                        <ScrollArea className="h-80">
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
                                <div className="flex w-full items-start space-x-2">
                                  <Checkbox
                                    className="mt-1"
                                    checked={selectedParticipants.includes(
                                      user._id,
                                    )}
                                    onCheckedChange={() => {}}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {user.name}
                                    </div>
                                    <div className="text-muted-foreground text-sm">
                                      {user.email}
                                    </div>
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
                  <div className="mt-2">
                    <p className="mb-2 text-sm font-medium">
                      Participants sélectionnés :
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedParticipants.map((participantId) => {
                        const user = users?.find((u) => u._id === participantId)
                        return user ? (
                          <div
                            key={participantId}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs text-blue-800"
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
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="questionIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Questions de l&apos;examen</FormLabel>
                    <FormDescription>
                      Sélectionnez {numberOfQuestions} questions qui composeront
                      cet examen.
                    </FormDescription>
                    <QuestionSelector
                      selectedQuestions={selectedQuestions}
                      onSelectionChange={handleQuestionSelectionChange}
                      maxQuestions={numberOfQuestions}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3 border-t pt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => router.push("/admin/exams")}
                >
                  Annuler
                </Button>
                <Button
                  variant={"none"}
                  type="submit"
                  className="cursor-pointer bg-blue-600 text-white hover:bg-blue-600/90"
                  disabled={selectedQuestions.length < numberOfQuestions}
                >
                  Modifier l&apos;examen ({selectedQuestions.length} question
                  {selectedQuestions.length > 1 ? "s" : ""})
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminEditExamPage
