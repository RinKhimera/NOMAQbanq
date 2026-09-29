"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateProfile } from "@/features/users/actions"
import type { CurrentUser } from "@/features/users/dal"
import { bioSchema, nameSchema, usernameSchema } from "@/features/users/schemas"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { callAction } from "@/lib/safe-action"
import { InlineEditField } from "./inline-edit-field"

export const ProfilePersonalInfo = ({ user }: { user: CurrentUser }) => {
  const router = useRouter()
  const { refetch } = useCurrentUser()

  const handleSaveField = async (
    fieldName: "name" | "username" | "bio",
    value: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await callAction(() =>
      updateProfile({
        name: fieldName === "name" ? value : user.name,
        username: fieldName === "username" ? value : user.username || "",
        bio: fieldName === "bio" ? value || undefined : (user.bio ?? undefined),
      }),
    )
    if (!result.success) {
      return {
        success: false,
        error: result.error || "Erreur lors de la sauvegarde",
      }
    }
    toast.success("Modification enregistrée")
    await refetch({ query: { disableCookieCache: true } }).catch(() => {})
    router.refresh()
    return { success: true }
  }

  return (
    <div className="flex flex-col">
      <InlineEditField
        testId="profile-field-name"
        label="Nom complet"
        value={user.name}
        placeholder="Entrez votre nom complet"
        schema={nameSchema}
        maxLength={50}
        onSave={(value) => handleSaveField("name", value)}
      />
      <InlineEditField
        testId="profile-field-username"
        label="Nom d'utilisateur"
        value={user.username || ""}
        placeholder="votre_nom_utilisateur"
        emptyText="Aucun nom d'utilisateur"
        schema={usernameSchema}
        maxLength={20}
        onSave={(value) => handleSaveField("username", value)}
      />
      <InlineEditField
        testId="profile-field-bio"
        label="Biographie"
        value={user.bio || ""}
        placeholder="Parlez brièvement de vous"
        emptyText="Aucune biographie"
        schema={bioSchema}
        maxLength={200}
        showCharCount
        inputType="textarea"
        onSave={(value) => handleSaveField("bio", value)}
      />
    </div>
  )
}
