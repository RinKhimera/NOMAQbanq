import { ErrorState } from "@/components/shared/error-state"
import { getNotificationPreferences } from "@/features/notifications/dal"
import {
  getCurrentUser,
  getLoginMethods,
  getUserSessions,
} from "@/features/users/dal"
import { env } from "@/lib/env/server"
import { ProfileView } from "./profile-view"

/**
 * Page de profil, commune à l'espace étudiant et à l'administration :
 * `profilePath` sert au réessai et au retour de l'OAuth Google.
 */
export const ProfilePage = async ({ profilePath }: { profilePath: string }) => {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return (
      <ErrorState
        title="Profil introuvable"
        description="Impossible de charger votre profil. Veuillez réessayer."
        retryHref={profilePath}
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
      profilePath={profilePath}
    />
  )
}
