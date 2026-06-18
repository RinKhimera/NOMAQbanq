"use client"

import { AlertTriangle, Loader2, Shield } from "lucide-react"

import { authClient } from "@/lib/auth-client"

interface AdminProtectionProps {
  children: React.ReactNode
}

// Garde CLIENT (défense en profondeur). La protection serveur fait foi : les layouts
// admin appellent `requireRole(['admin'])` côté Server Component.
export default function AdminProtection({ children }: AdminProtectionProps) {
  const { data, isPending } = authClient.useSession()
  const isAdmin = data?.user?.role === "admin"

  if (isPending) {
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
