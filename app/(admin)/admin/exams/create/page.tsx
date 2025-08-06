"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowLeft, Calendar } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import { QuestionSelector } from "@/components/admin/QuestionSelector"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

const examFormSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
  description: z.string().optional(),
  startDate: z.date({
    required_error: "Veuillez sélectionner une date de début",
  }),
  numberOfQuestions: z
    .number()
    .min(10, "Minimum 10 questions")
    .max(115, "Maximum 115 questions"),
  questionIds: z
    .array(z.custom<Id<"questions">>())
    .min(1, "Sélectionnez au moins une question"),
})

type ExamFormValues = z.infer<typeof examFormSchema>

const AdminCreateExamPage = () => {
  const router = useRouter()
  const [selectedQuestions, setSelectedQuestions] = useState<Id<"questions">[]>(
    [],
  )

  const createExam = useMutation(api.exams.createExam)

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      title: "",
      description: "",
      numberOfQuestions: 115,
      questionIds: [],
    },
  })

  const numberOfQuestions = form.watch("numberOfQuestions")

  // Génerer les options pour le select (de 10 à 115 par pas de 5)
  const generateQuestionOptions = () => {
    const options = []
    for (let i = 10; i <= 115; i += 5) {
      options.push(i)
    }
    return options
  }

  const onSubmit = async (values: ExamFormValues) => {
    try {
      // Validation: vérifier que le nombre de questions sélectionnées correspond au nombre requis
      if (selectedQuestions.length !== values.numberOfQuestions) {
        toast.error(
          `Veuillez sélectionner exactement ${values.numberOfQuestions} questions`,
        )
        return
      }

      // Calculer la date de fin (2 jours après le début)
      const startDate = values.startDate.getTime()
      const endDate = new Date(values.startDate)
      endDate.setDate(endDate.getDate() + 2)
      endDate.setHours(23, 59, 59, 999)

      await createExam({
        title: values.title,
        description: values.description,
        startDate,
        endDate: endDate.getTime(),
        questionIds: selectedQuestions,
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

  return (
    <div className="@container flex flex-col gap-4 p-4 md:gap-6 lg:p-6">
      {/* En-tête avec bouton retour */}
      <div className="flex flex-col justify-between gap-4 @md:flex-row @md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Créer un nouvel examen</h1>
          <p className="text-muted-foreground">
            Configurez une nouvelle session d&apos;examen pour vos étudiants
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/exams">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux examens
          </Link>
        </Button>
      </div>

      {/* Formulaire principal */}
      <Card>
        <CardHeader>
          <CardTitle>Informations de l&apos;examen</CardTitle>
          <CardDescription>
            La période d&apos;examen durera 2 jours à partir de la date
            sélectionnée.
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
                        <Select
                          value={field.value?.toString()}
                          onValueChange={(value) => {
                            const numValue = parseInt(value)
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
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner le nombre de questions" />
                          </SelectTrigger>
                          <SelectContent>
                            {generateQuestionOptions().map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num} questions
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date de début de l&apos;examen</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={`w-full pl-3 text-left font-normal ${
                                !field.value && "text-muted-foreground"
                              }`}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: fr })
                              ) : (
                                <span>Sélectionner une date</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => {
                              const today = new Date()
                              today.setHours(0, 0, 0, 0)
                              return (
                                date < today || date < new Date("1900-01-01")
                              )
                            }}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        L&apos;examen sera disponible pendant 2 jours à partir
                        de cette date.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

              <FormField
                control={form.control}
                name="questionIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Questions de l&apos;examen</FormLabel>
                    <FormDescription>
                      Sélectionnez {numberOfQuestions || 115} questions qui
                      composeront cet examen.
                    </FormDescription>
                    <QuestionSelector
                      selectedQuestions={selectedQuestions}
                      onSelectionChange={handleQuestionSelectionChange}
                      minQuestions={numberOfQuestions || 115}
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
                  type="submit"
                  className="cursor-pointer"
                  disabled={
                    selectedQuestions.length < (numberOfQuestions || 115)
                  }
                >
                  Créer l&apos;examen ({selectedQuestions.length} question
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

export default AdminCreateExamPage
