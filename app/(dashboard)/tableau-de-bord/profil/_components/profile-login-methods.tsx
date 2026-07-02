"use client"

import {
  IconBrandGoogle,
  IconKey,
  IconMail,
  IconPlugConnected,
} from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LoginMethods } from "@/features/users/dal"
import { authClient } from "@/lib/auth-client"
import { mapAuthError } from "@/lib/auth-errors"

type Props = {
  methods: LoginMethods
  email: string
  googleEnabled: boolean
  profilePath: string
  onSetPassword?: () => void
}

export const ProfileLoginMethods = ({
  methods,
  email,
  googleEnabled,
  profilePath,
  onSetPassword,
}: Props) => {
  const [busy, setBusy] = useState(false)

  const linkGoogle = async () => {
    setBusy(true)
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: profilePath,
    })
    if (error) {
      toast.error(mapAuthError(error).message)
      setBusy(false)
    }
    // Succès → redirection OAuth déclenchée par Better Auth.
  }

  const unlinkGoogle = async () => {
    setBusy(true)
    const { error } = await authClient.unlinkAccount({ providerId: "google" })
    setBusy(false)
    if (error) {
      const code = (error as { code?: string }).code
      // unlinkAccount exige une session « fraîche » (freshAge défaut = 24 h).
      if (code === "SESSION_NOT_FRESH") {
        toast.error(
          "Pour des raisons de sécurité, reconnectez-vous puis réessayez de délier ce compte.",
        )
        return
      }
      // Dernier moyen de connexion : garde native de Better Auth.
      if (code === "FAILED_TO_UNLINK_LAST_ACCOUNT") {
        toast.error(
          "Définissez d'abord un mot de passe pour ne pas perdre l'accès.",
        )
        return
      }
      toast.error(mapAuthError(error).message)
      return
    }
    toast.success("Compte Google délié")
    location.reload()
  }

  const resendVerification = async () => {
    setBusy(true)
    const { error } = await authClient.sendVerificationEmail({ email })
    setBusy(false)
    if (error) {
      toast.error(mapAuthError(error).message)
      return
    }
    toast.success("Email de vérification envoyé")
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
      <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <IconPlugConnected className="h-5 w-5 text-white" />
          </div>
          <span className="font-display font-semibold text-gray-900 dark:text-white">
            Méthodes de connexion
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {/* Email + vérification */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <IconMail className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {email}
              </p>
              {methods.emailVerified ? (
                <Badge variant="secondary" className="mt-1">
                  Vérifié
                </Badge>
              ) : (
                <Badge variant="destructive" className="mt-1">
                  Non vérifié
                </Badge>
              )}
            </div>
          </div>
          {!methods.emailVerified && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={resendVerification}
              data-testid="login-method-resend-verification"
            >
              Renvoyer l&apos;email
            </Button>
          )}
        </div>

        {/* Mot de passe */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <IconKey className="h-5 w-5 text-gray-500" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Mot de passe {methods.hasPassword ? "défini" : "non défini"}
            </p>
          </div>
          {!methods.hasPassword && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSetPassword}
              data-testid="login-method-set-password"
            >
              Définir un mot de passe
            </Button>
          )}
        </div>

        {/* Google */}
        {googleEnabled && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <IconBrandGoogle className="h-5 w-5 text-gray-500" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Google {methods.google.linked ? "connecté" : "non connecté"}
              </p>
            </div>
            {methods.google.linked ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={unlinkGoogle}
                data-testid="login-method-google-unlink"
              >
                Délier
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={linkGoogle}
                data-testid="login-method-google-link"
              >
                Lier Google
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
