import { unstable_rethrow } from "next/navigation"
import { ErrorState } from "@/components/shared/error-state"
import { getNotificationPreferences } from "@/features/notifications/dal"
import {
  getCurrentUser,
  getLoginMethods,
  getUserSessions,
} from "@/features/users/dal"
import { getMyAdminActivity } from "@/features/users/dal.activity"
import { env } from "@/lib/env/server"
import { captureServerError } from "@/lib/observability"
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

  const [methods, sessions, notificationPreferences, adminActivity] =
    await Promise.all([
      getLoginMethods(),
      getUserSessions(),
      getNotificationPreferences(),
      // L'activité n'est qu'une section : son échec ne doit pas emporter le
      // profil, où l'admin gère aussi ses alertes et ses appareils.
      currentUser.role === "admin"
        ? getMyAdminActivity().catch((error: unknown) => {
            unstable_rethrow(error)
            captureServerError("[profil:activite]", error, {
              userId: currentUser.id,
            })
            return null
          })
        : null,
    ])

  return (
    <ProfileView
      user={currentUser}
      methods={methods}
      sessions={sessions}
      notificationPreferences={notificationPreferences}
      adminActivity={adminActivity}
      googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
      profilePath={profilePath}
    />
  )
}
