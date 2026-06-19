import { z } from "zod"

// Schémas par champ — réutilisés côté client (édition inline) ET serveur (action).
export const nameSchema = z
  .string()
  .trim()
  .min(2, "Le nom doit contenir au moins 2 caractères")
  .max(50, "Le nom ne peut pas dépasser 50 caractères")

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
  .max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères")
  // On accepte la saisie mixte ; l'action normalise en minuscules avant sauvegarde.
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Caractères autorisés : lettres, chiffres, underscore",
  )

export const bioSchema = z
  .string()
  .trim()
  .max(200, "La biographie ne peut pas dépasser 200 caractères")

export const profileSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  bio: bioSchema.optional(),
})

export type ProfileFormValues = z.infer<typeof profileSchema>
