"use client"

import { Globe, KeyRound, Mail } from "lucide-react"
import { type Ref, useState } from "react"
import { toast } from "sonner"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import type { LoginMethods } from "@/features/users/dal"
import { authClient } from "@/lib/auth-client"
import { mapAuthError } from "@/lib/auth-errors"
import { ProfileRow } from "./profile-section"

type Props = {
  methods: LoginMethods
  email: string
  googleEnabled: boolean
  profilePath: string
  /** Compte Google seul : ouvre le formulaire « définir un mot de passe ». */
  onSetPassword?: () => void
  /** Mot de passe défini : ouvre ou ferme le formulaire de modification. */
  onTogglePassword?: () => void
  passwordFormOpen?: boolean
  /** Bouton « Modifier » : il reprend le focus quand le formulaire se referme. */
  passwordToggleRef?: Ref<HTMLButtonElement>
}

const ACTION = "max-md:h-11"

export const ProfileLoginMethods = ({
  methods,
  email,
  googleEnabled,
  profilePath,
  onSetPassword,
  onTogglePassword,
  passwordFormOpen = false,
  passwordToggleRef,
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
    if (!methods.google.linked) return
    setBusy(true)
    const { error } = await authClient.unlinkAccount({
      accountId: methods.google.accountId,
    })
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
    toast.success("Courriel de vérification envoyé")
  }

  // Garde sans `disabled` : le bouton garde le focus pendant l'appel.
  const guarded = (run: () => void) => () => {
    if (!busy) run()
  }

  return (
    <div className="flex flex-col">
      <ProfileRow
        icon={<Mail />}
        title={email}
        detail="Adresse de connexion · non modifiable"
        badge={
          methods.emailVerified ? (
            <StatusPill tone="success">Vérifiée</StatusPill>
          ) : (
            <StatusPill tone="danger">Non vérifiée</StatusPill>
          )
        }
        action={
          !methods.emailVerified && (
            <Button
              size="sm"
              variant="outline"
              aria-disabled={busy}
              onClick={guarded(resendVerification)}
              data-testid="login-method-resend-verification"
              className={ACTION}
            >
              Renvoyer le courriel
            </Button>
          )
        }
      />

      <ProfileRow
        icon={<KeyRound />}
        title="Mot de passe"
        detail={
          methods.hasPassword
            ? "Défini"
            : "Non défini · vous vous connectez avec Google"
        }
        action={
          methods.hasPassword ? (
            <Button
              ref={passwordToggleRef}
              size="sm"
              variant="outline"
              onClick={onTogglePassword}
              aria-expanded={passwordFormOpen}
              data-testid="login-method-change-password"
              className={ACTION}
            >
              {passwordFormOpen ? "Annuler" : "Modifier"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onSetPassword}
              data-testid="login-method-set-password"
              className={ACTION}
            >
              Définir un mot de passe
            </Button>
          )
        }
      />

      {googleEnabled && (
        <ProfileRow
          icon={<Globe />}
          title="Google"
          detail={methods.google.linked ? "Lié" : "Non lié"}
          action={
            methods.google.linked ? (
              <Button
                size="sm"
                variant="outline"
                aria-disabled={busy}
                onClick={guarded(unlinkGoogle)}
                data-testid="login-method-google-unlink"
                className={ACTION}
              >
                Délier
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                aria-disabled={busy}
                onClick={guarded(linkGoogle)}
                data-testid="login-method-google-link"
                className={ACTION}
              >
                Lier
              </Button>
            )
          }
        />
      )}
    </div>
  )
}
