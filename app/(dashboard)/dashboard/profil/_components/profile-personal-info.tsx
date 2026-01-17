"use client"

import { IconAt, IconFileText, IconUser } from "@tabler/icons-react"
import { User } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { Doc } from "@/convex/_generated/dataModel"
import { InlineEditField } from "./inline-edit-field"

type ProfilePersonalInfoProps = {
  user: Doc<"users">
}

// Validation schemas
const nameSchema = z
  .string()
  .trim()
  .min(2, "Le nom doit contenir au moins 2 caractères")
  .max(50, "Le nom ne peut pas dépasser 50 caractères")

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
  .max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères")
  .transform((v) => v.toLowerCase())
  .refine((v) => /^[a-z0-9_]+$/.test(v), {
    message: "Caractères autorisés: lettres, chiffres, underscore",
  })

const bioSchema = z
  .string()
  .trim()
  .max(200, "La biographie ne peut pas dépasser 200 caractères")

export const ProfilePersonalInfo = ({ user }: ProfilePersonalInfoProps) => {
  const prefersReducedMotion = useReducedMotion()
  const updateProfile = useMutation(api.users.updateUserProfile)

  const handleSaveField = async (
    fieldName: "name" | "username" | "bio",
    value: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await updateProfile({
        name: fieldName === "name" ? value : user.name,
        username: fieldName === "username" ? value : (user.username || ""),
        bio: fieldName === "bio" ? (value || undefined) : user.bio,
      })

      if (result.success) {
        toast.success("Modification enregistrée")
        return { success: true }
      } else {
        return { success: false, error: result.error || "Erreur lors de la sauvegarde" }
      }
    } catch (error) {
      console.error("Update error:", error)
      return { success: false, error: "Une erreur est survenue" }
    }
  }

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const },
      }

  return (
    <motion.div {...motionProps}>
      <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
        <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
              <User className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-semibold text-gray-900 dark:text-white">
              Informations personnelles
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="divide-y divide-gray-100 p-0 dark:divide-gray-800">
          {/* Name field */}
          <InlineEditField
            label="Nom complet"
            icon={IconUser}
            iconColorClass="text-blue-600 dark:text-blue-400"
            iconBgClass="bg-blue-100 dark:bg-blue-900/30"
            value={user.name}
            placeholder="Entrez votre nom complet"
            schema={nameSchema}
            maxLength={50}
            onSave={(value) => handleSaveField("name", value)}
          />

          {/* Username field */}
          <InlineEditField
            label="Nom d'utilisateur"
            icon={IconAt}
            iconColorClass="text-purple-600 dark:text-purple-400"
            iconBgClass="bg-purple-100 dark:bg-purple-900/30"
            value={user.username || ""}
            placeholder="votre_username"
            emptyText="Aucun nom d'utilisateur"
            schema={usernameSchema}
            maxLength={20}
            onSave={(value) => handleSaveField("username", value)}
          />

          {/* Bio field */}
          <InlineEditField
            label="Biographie"
            icon={IconFileText}
            iconColorClass="text-indigo-600 dark:text-indigo-400"
            iconBgClass="bg-indigo-100 dark:bg-indigo-900/30"
            value={user.bio || ""}
            placeholder="Parlez-nous un peu de vous..."
            emptyText="Aucune biographie"
            schema={bioSchema}
            maxLength={200}
            showCharCount
            inputType="textarea"
            textareaRows={3}
            onSave={(value) => handleSaveField("bio", value)}
          />
        </CardContent>
      </Card>
    </motion.div>
  )
}
