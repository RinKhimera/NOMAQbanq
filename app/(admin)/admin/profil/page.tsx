"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { ProfileHeader } from "@/app/(dashboard)/dashboard/profil/_components/profile-header"
import { ProfilePersonalInfo } from "@/app/(dashboard)/dashboard/profil/_components/profile-personal-info"
import { ProfilePreferences } from "@/app/(dashboard)/dashboard/profil/_components/profile-preferences"
import { ProfileSecurity } from "@/app/(dashboard)/dashboard/profil/_components/profile-security"
import { ProfileSkeleton } from "@/app/(dashboard)/dashboard/profil/_components/profile-skeleton"

export default function AdminProfilPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  // Skip queries until authenticated to avoid race condition on page reload
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? undefined : "skip",
  )

  // Handle avatar change - Convex reactivity automatically refreshes the UI
  const handleAvatarChange = () => {}

  // Loading state
  if (isAuthLoading || currentUser === undefined) {
    return <ProfileSkeleton />
  }

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

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header with avatar */}
      <ProfileHeader user={currentUser} onAvatarChange={handleAvatarChange} />

      {/* Personal information - editable */}
      <ProfilePersonalInfo user={currentUser} />

      {/* Security section */}
      <ProfileSecurity />

      {/* Preferences - coming soon */}
      <ProfilePreferences />
    </div>
  )
}
