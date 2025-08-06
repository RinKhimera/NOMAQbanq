"use client"

import { ArrowLeft, RefreshCw, Settings } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Admin Panel Error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <Settings className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl text-gray-900 dark:text-white">
            Erreur dans le panneau d&apos;administration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Une erreur s&apos;est produite dans le panneau
            d&apos;administration. Veuillez réessayer ou retourner au tableau de
            bord principal.
          </p>

          {process.env.NODE_ENV === "development" && (
            <div className="rounded-lg bg-gray-100 p-3 text-left dark:bg-gray-800">
              <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
                <strong>Erreur:</strong> {error.message}
              </p>
              {error.digest && (
                <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
                  <strong>ID:</strong> {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={reset}
              className="flex items-center gap-2"
              variant="default"
            >
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>

            <Button
              onClick={() => (window.location.href = "/admin")}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour Admin
            </Button>
          </div>

          <Button
            onClick={() => (window.location.href = "/dashboard")}
            variant="ghost"
            className="text-sm"
          >
            Aller au tableau de bord utilisateur
          </Button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Si cette erreur persiste, vérifiez vos permissions
            d&apos;administrateur.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
