import { ProfileAccountSection } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-account-section"
import { ProfileDangerZone } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-danger-zone"
import { ProfileHeader } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-header"
import { ProfilePersonalInfo } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-personal-info"
import { ProfilePreferences } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-preferences"
import { ProfileSessions } from "@/app/(dashboard)/tableau-de-bord/profil/_components/profile-sessions"
import { getNotificationPreferences } from "@/features/notifications/dal"
import {
  getCurrentUser,
  getLoginMethods,
  getUserSessions,
} from "@/features/users/dal"
import { env } from "@/lib/env/server"

export default async function AdminProfilPage() {
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

  const [methods, sessions, notificationPreferences] = await Promise.all([
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

      {/* Account & security */}
      {methods && (
        <ProfileAccountSection
          methods={methods}
          email={currentUser.email}
          googleEnabled={googleEnabled}
          profilePath="/admin/profil"
        />
      )}

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
