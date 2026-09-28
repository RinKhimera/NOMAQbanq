import type { Metadata } from "next"
import { ErrorState } from "@/components/shared/error-state"
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
            profilePath="/tableau-de-bord/profil"
          />
        )}
        <ProfileSubscriptionCard accessStatus={accessStatus} />
      </div>

      {/* Connected devices */}
      <ProfileSessions sessions={sessions} />

      {/* Preferences */}
      <ProfilePreferences
        notificationPreferences={
          notificationPreferences ?? {
            examResults: true,
            accessExpiry: true,
            marketing: true,
          }
        }
      />

      {/* Danger zone */}
      <ProfileDangerZone email={currentUser.email} />
    </div>
  )
}
