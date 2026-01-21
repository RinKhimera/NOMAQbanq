import * as z from "zod"

export const userFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(50, "Le nom ne peut pas dépasser 50 caractères"),
  username: z
    .string()
    .trim()
    .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
    .max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères")
    .transform((v) => v.toLowerCase())
    .refine((v) => /^[a-z0-9_]+$/.test(v), {
      message: "Caractères autorisés: lettres, chiffres, underscore",
    }),
  bio: z
    .string()
    .trim()
    .max(200, "La biographie ne peut pas dépasser 200 caractères")
    .optional(),
})

export type UserFormValues = z.infer<typeof userFormSchema>
