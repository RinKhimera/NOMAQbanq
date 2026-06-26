"use client"

import { IconAt, IconFileText, IconUser } from "@tabler/icons-react"
import { User } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { updateProfile } from "@/features/users/actions"
import { CurrentUser } from "@/features/users/dal"
import { bioSchema, nameSchema, usernameSchema } from "@/features/users/schemas"
import { InlineEditField } from "./inline-edit-field"

type ProfilePersonalInfoProps = {
  user: CurrentUser
}

export const ProfilePersonalInfo = ({ user }: ProfilePersonalInfoProps) => {
  const prefersReducedMotion = useReducedMotion()
  const router = useRouter()

  const handleSaveField = async (
    fieldName: "name" | "username" | "bio",
    value: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await updateProfile({
        name: fieldName === "name" ? value : user.name,
        username: fieldName === "username" ? value : user.username || "",
        bio: fieldName === "bio" ? value || undefined : (user.bio ?? undefined),
      })

      if (result.success) {
        toast.success("Modification enregistrée")
        router.refresh()
        return { success: true }
      } else {
        return {
          success: false,
          error: result.error || "Erreur lors de la sauvegarde",
        }
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
        transition: {
          duration: 0.5,
          delay: 0.1,
          ease: [0.16, 1, 0.3, 1] as const,
        },
      }

  return (
    <motion.div {...motionProps}>
      <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
        <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
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
