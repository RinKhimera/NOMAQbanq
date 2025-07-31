"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

const examFormSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
  description: z.string().optional(),
  startDate: z.date({
    required_error: "Veuillez sélectionner une date de début",
  }),
  questionIds: z.array(z.string()).min(1, "Sélectionnez au moins une question"),
})

type ExamFormValues = z.infer<typeof examFormSchema>

export function CreateExamDialog() {
  const [open, setOpen] = useState(false)
  const [selectedQuestions, setSelectedQuestions] = useState<Id<"questions">[]>(
    [],
  )

  const createExam = useMutation(api.exams.createExam)
  const questions = useQuery(api.questions.getAllQuestions)

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      title: "",
      description: "",
      questionIds: [],
    },
  })

  const onSubmit = async (values: ExamFormValues) => {
    try {
      // Calculer la date de fin (1 jour après le début)
      const startDate = values.startDate.getTime()
      const endDate = new Date(values.startDate)
      endDate.setDate(endDate.getDate() + 1)
      endDate.setHours(23, 59, 59, 999) // Fin de journée

      await createExam({
        title: values.title,
        description: values.description,
        startDate,
        endDate: endDate.getTime(),
        questionIds: selectedQuestions,
      })

      toast.success("Examen créé avec succès")
      setOpen(false)
      form.reset()
      setSelectedQuestions([])
    } catch (error) {
      toast.error("Erreur lors de la création de l'examen")
      console.error(error)
    }
  }

  const handleQuestionToggle = (questionId: Id<"questions">) => {
    setSelectedQuestions((prev) => {
      const updated = prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]

      form.setValue("questionIds", updated)
      return updated
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Créer un nouvel examen</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouvel examen</DialogTitle>
          <DialogDescription>
            Créez une nouvelle session d&apos;examen. La période d&apos;examen
            durera 2 jours à partir de la date sélectionnée.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description de l'examen..."
                      {...field}
                    />
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
                          className={`w-[240px] pl-3 text-left font-normal ${
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
                        disabled={(date) =>
                          date < new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    L&apos;examen sera disponible pendant 2 jours à partir de
                    cette date.
                  </FormDescription>
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
                    Sélectionnez les questions qui composeront cet examen.
                  </FormDescription>
                  <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                    {questions?.map((question) => (
                      <div
                        key={question._id}
                        className="mb-4 flex items-start space-x-3"
                      >
                        <Checkbox
                          checked={selectedQuestions.includes(question._id)}
                          onCheckedChange={() =>
                            handleQuestionToggle(question._id)
                          }
                        />
                        <div className="flex-1">
                          <p className="text-sm leading-none font-medium">
                            {question.question}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Domaine: {question.domain}
                          </p>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit">Créer l&apos;examen</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
