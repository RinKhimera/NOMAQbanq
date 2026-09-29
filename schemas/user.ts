import * as z from "zod"
import {
  BIO_MAX,
  NAME_MAX,
  NAME_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from "@/features/users/schemas"

export const userFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN, `Le nom doit contenir au moins ${NAME_MIN} caractères`)
    .max(NAME_MAX, `Le nom ne peut pas dépasser ${NAME_MAX} caractères`),
  username: z
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
    .transform((v) => v.toLowerCase())
    .refine((v) => /^[a-z0-9_]+$/.test(v), {
      message: "Caractères autorisés: lettres, chiffres, underscore",
    }),
  bio: z
    .string()
    .trim()
    .max(BIO_MAX, `La biographie ne peut pas dépasser ${BIO_MAX} caractères`)
    .optional(),
})

export type UserFormValues = z.infer<typeof userFormSchema>
