import * as z from "zod"

const emailField = z
  .string()
  .trim()
  .min(1, "L'adresse courriel est requise")
  .email("Adresse courriel invalide")

const passwordField = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .max(128, "Le mot de passe ne peut pas dépasser 128 caractères")

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Le mot de passe est requis"),
})

export type SignInFormValues = z.infer<typeof signInSchema>

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(50, "Le nom ne peut pas dépasser 50 caractères"),
  email: emailField,
  password: passwordField,
})

export type SignUpFormValues = z.infer<typeof signUpSchema>

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, "La confirmation est requise"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, "La confirmation est requise"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
