import type { Metadata } from "next"
import { ErrorState } from "@/components/shared/error-state"
import { getNotificationPreferences } from "@/features/notifications/dal"
import {
  getCurrentUser,
  getLoginMethods,
  getUserSessions,
} from "@/features/users/dal"
import { env } from "@/lib/env/server"
import { ProfileView } from "./_components/profile-view"

export const metadata: Metadata = { title: "Profil" }

export default async function ProfilPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return (
      <ErrorState
        title="Profil introuvable"
        description="Impossible de charger votre profil. Veuillez réessayer."
        retryHref="/tableau-de-bord/profil"
      />
    )
  }

  const [methods, sessions, notificationPreferences] = await Promise.all([
    getLoginMethods(),
    getUserSessions(),
    getNotificationPreferences(),
  ])

  return (
    <ProfileView
      user={currentUser}
      methods={methods}
      sessions={sessions}
      notificationPreferences={notificationPreferences}
      googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
      profilePath="/tableau-de-bord/profil"
    />
  )
}
