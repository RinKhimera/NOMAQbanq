"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db"
import { user } from "@/db/schema"
import { requireSession } from "@/lib/auth-guards"
import { applyMarketingPreferenceByToken } from "./unsubscribe"

const schema = z.object({
  examResults: z.boolean(),
  accessExpiry: z.boolean(),
  marketing: z.boolean(),
})

export type UpdateNotificationsResult = { success: boolean; error?: string }

export const updateNotificationPreferences = async (input: {
  examResults: boolean
  accessExpiry: boolean
  marketing: boolean
}): Promise<UpdateNotificationsResult> => {
  const session = await requireSession()
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }
  await db
    .update(user)
    .set({
      notifyExamResults: parsed.data.examResults,
      notifyAccessExpiry: parsed.data.accessExpiry,
      notifyMarketing: parsed.data.marketing,
    })
    .where(eq(user.id, session.user.id))
  revalidatePath("/tableau-de-bord/profil")
  revalidatePath("/admin/profil")
  return { success: true }
}

// Publiques (pas de session) : l'autorisation est le jeton signé lui-même.
const tokenSchema = z.object({ token: z.string().min(1) })

const setMarketingByToken = async (
  input: { token: string },
  enabled: boolean,
): Promise<UpdateNotificationsResult> => {
  const parsed = tokenSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Lien invalide" }
  const outcome = await applyMarketingPreferenceByToken(
    parsed.data.token,
    enabled,
  )
  return outcome === "updated"
    ? { success: true }
    : { success: false, error: "Ce lien n'est plus valide" }
}

export const unsubscribeWithToken = async (input: { token: string }) =>
  setMarketingByToken(input, false)

export const resubscribeWithToken = async (input: { token: string }) =>
  setMarketingByToken(input, true)
