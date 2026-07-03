"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db"
import { user } from "@/db/schema"
import { requireSession } from "@/lib/auth-guards"

const schema = z.object({
  examResults: z.boolean(),
  accessExpiry: z.boolean(),
})

export type UpdateNotificationsResult = { success: boolean; error?: string }

export const updateNotificationPreferences = async (input: {
  examResults: boolean
  accessExpiry: boolean
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
    })
    .where(eq(user.id, session.user.id))
  revalidatePath("/tableau-de-bord/profil")
  revalidatePath("/admin/profil")
  return { success: true }
}
