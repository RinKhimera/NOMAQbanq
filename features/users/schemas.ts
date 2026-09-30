import { z } from "zod"

/** Longueurs des champs du profil : les formulaires (maxLength, compteur) les lisent ici. */
export const NAME_MIN = 2
export const NAME_MAX = 50
export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
export const BIO_MAX = 200

// Schémas par champ — réutilisés côté client (édition inline) ET serveur (action).
export const nameSchema = z
  .string()
  .trim()
  .min(NAME_MIN, `Le nom doit contenir au moins ${NAME_MIN} caractères`)
  .max(NAME_MAX, `Le nom ne peut pas dépasser ${NAME_MAX} caractères`)

export const usernameSchema = z
  .string()
  .trim()
  .min(
    USERNAME_MIN,
    `Le nom d'utilisateur doit contenir au moins ${USERNAME_MIN} caractères`,
  )
  .max(
    USERNAME_MAX,
    `Le nom d'utilisateur ne peut pas dépasser ${USERNAME_MAX} caractères`,
  )
  // On accepte la saisie mixte ; l'action normalise en minuscules avant sauvegarde.
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Caractères autorisés : lettres, chiffres, underscore",
  )

export const bioSchema = z
  .string()
  .trim()
  .max(BIO_MAX, `La biographie ne peut pas dépasser ${BIO_MAX} caractères`)

export const profileSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  bio: bioSchema.optional(),
})

export type ProfileFormValues = z.infer<typeof profileSchema>

export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, "Utilisateur requis"),
  role: z.enum(["user", "admin"]),
})

export const banUserSchema = z.object({
  userId: z.string().min(1, "Utilisateur requis"),
  reason: z
    .string()
    .trim()
    .min(5, "Le motif doit contenir au moins 5 caractères")
    .max(500, "Le motif ne peut pas dépasser 500 caractères"),
})

export const unbanUserSchema = z.object({
  userId: z.string().min(1, "Utilisateur requis"),
  reason: z
    .string()
    .trim()
    .max(500, "Le motif ne peut pas dépasser 500 caractères")
    .optional(),
})

const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Filtres de la liste des utilisateurs, reçus du client (export). */
export const usersFiltersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: z.enum(["admin", "user"]).optional(),
  segment: z.enum(["all", "active", "expiring", "expired", "never"]).optional(),
  suspended: z.boolean().optional(),
  dateFrom: calendarDay.optional(),
  dateTo: calendarDay.optional(),
})
