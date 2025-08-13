import { z } from "zod"

export const userProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(50, "Le nom ne peut pas dépasser 50 caractères"),
  username: z
    .string()
    .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
    .max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères"),
  /*  .regex(
      /^[a-zA-Z0-9_]+$/,
      "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores",
    ) */
  bio: z
    .string()
    .max(200, "La biographie ne peut pas dépasser 200 caractères")
    .optional(),
  avatar: z.string().url("L'URL de l'avatar doit être valide").optional(),
})

export type UserProfile = z.infer<typeof userProfileSchema>
