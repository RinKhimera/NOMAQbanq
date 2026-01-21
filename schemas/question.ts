import * as z from "zod"

export const questionFormSchema = z
  .object({
    question: z.string().min(1, "La question est obligatoire"),
    options: z
      .array(z.string())
      .min(4, "Au moins 4 options sont requises")
      .max(5, "Maximum 5 options autorisées"),
    correctAnswer: z
      .string()
      .min(1, "Vous devez sélectionner une réponse correcte"),
    explanation: z.string().min(1, "L'explication est obligatoire"),
    references: z.array(z.string()).optional(),
    objectifCMC: z.string().trim().min(1, "L'objectif CMC est obligatoire"),
    domain: z.string().min(1, "Le domaine est obligatoire"),
  })
  .refine(
    (data) => {
      const validOptions = data.options.filter((opt) => opt.trim() !== "")
      return validOptions.length >= 4
    },
    {
      message: "Au moins 4 options non vides sont requises",
      path: ["options"],
    },
  )

export type QuestionFormValues = z.infer<typeof questionFormSchema>

// Validation customisée pour vérifier que la réponse correcte est dans les options
export const validateCorrectAnswer = (data: QuestionFormValues) => {
  const filteredOptions = data.options.filter((opt) => opt.trim() !== "")
  return filteredOptions.includes(data.correctAnswer)
}

// Helper pour filtrer les options vides tout en gardant au moins 4
export const filterValidOptions = (options: string[]) => {
  return options.filter((opt) => opt.trim() !== "")
}

// Helper pour filtrer les références vides
export const filterValidReferences = (references: string[] | undefined) => {
  if (!references) return undefined
  const filtered = references.filter((ref) => ref.trim() !== "")
  return filtered.length > 0 ? filtered : undefined
}
