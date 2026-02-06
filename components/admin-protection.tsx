"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { AlertTriangle, Loader2, Shield } from "lucide-react"
import { api } from "@/convex/_generated/api"

interface AdminProtectionProps {
  children: React.ReactNode
}

export default function AdminProtection({ children }: AdminProtectionProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  // Skip query until Clerk auth is ready to avoid race condition on page reload
  const isAdmin = useQuery(
    api.users.isCurrentUserAdmin,
    isAuthenticated ? undefined : "skip"
  )

  // Loading state: only show loader while auth is loading OR while query is loading
  // Don't show loader if user is simply not authenticated (that's a denial case)
  if (isAuthLoading || (isAuthenticated && isAdmin === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600 dark:text-gray-300">
            Vérification des permissions...
          </p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-red-900/30">
        <div className="mx-auto max-w-md p-8 text-center">
          <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
            <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-500" />
            <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
              Accès refusé
            </h1>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Cette section est réservée aux administrateurs.
            </p>
            <div className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              <Shield className="mr-2 h-4 w-4" />
              Zone protégée
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
