import { getNotificationPreferences } from "@/features/notifications/dal"
import { getAccessStatus } from "@/features/payments/dal"
import {
  getCurrentUser,
  getLoginMethods,
  getUserSessions,
} from "@/features/users/dal"
import { env } from "@/lib/env/server"
import { ProfileAccountSection } from "./_components/profile-account-section"
import { ProfileDangerZone } from "./_components/profile-danger-zone"
import { ProfileHeader } from "./_components/profile-header"
import { ProfilePersonalInfo } from "./_components/profile-personal-info"
import { ProfilePreferences } from "./_components/profile-preferences"
import { ProfileSessions } from "./_components/profile-sessions"
import { ProfileSubscriptionCard } from "./_components/profile-subscription-card"

export default async function ProfilPage() {
  const currentUser = await getCurrentUser()

  // Error state - user not found
  if (!currentUser) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profil introuvable
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Impossible de charger votre profil. Veuillez réessayer.
          </p>
        </div>
      </div>
    )
  }

  const [accessStatus, methods, sessions, notificationPreferences] =
    await Promise.all([
      getAccessStatus(),
      getLoginMethods(),
      getUserSessions(),
      getNotificationPreferences(),
    ])
  const googleEnabled = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header with avatar */}
      <ProfileHeader user={currentUser} />

      {/* Personal information - editable */}
      <ProfilePersonalInfo user={currentUser} />

      {/* Two column grid: account/security and subscription */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {methods && (
          <ProfileAccountSection
            methods={methods}
            email={currentUser.email}
            googleEnabled={googleEnabled}
            profilePath="/dashboard/profil"
          />
        )}
        <ProfileSubscriptionCard accessStatus={accessStatus} />
      </div>

      {/* Connected devices */}
      <ProfileSessions sessions={sessions} />

      {/* Preferences */}
      <ProfilePreferences
        notificationPreferences={
          notificationPreferences ?? { examResults: true, accessExpiry: true }
        }
      />

      {/* Danger zone */}
      <ProfileDangerZone email={currentUser.email} />
    </div>
  )
}
