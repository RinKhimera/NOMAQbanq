import { getAccessStatus } from "@/features/payments/dal"
import { getCurrentUser } from "@/features/users/dal"
import { ProfileHeader } from "./_components/profile-header"
import { ProfilePersonalInfo } from "./_components/profile-personal-info"
import { ProfilePreferences } from "./_components/profile-preferences"
import { ProfileSecurity } from "./_components/profile-security"
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

  const accessStatus = await getAccessStatus()

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header with avatar */}
      <ProfileHeader user={currentUser} />

      {/* Personal information - editable */}
      <ProfilePersonalInfo user={currentUser} />

      {/* Two column grid for Security and Subscription on larger screens */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Security section */}
        <ProfileSecurity />

        {/* Subscription summary */}
        <ProfileSubscriptionCard accessStatus={accessStatus} />
      </div>

      {/* Preferences - coming soon */}
      <ProfilePreferences />
    </div>
  )
}
