"use client"

import { Mail } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { mapAuthError } from "@/lib/auth-errors"

const RESEND_COOLDOWN_SECONDS = 45

interface CheckEmailNoticeProps {
  email: string
  mode: "signup" | "verify"
}

export function CheckEmailNotice({ email, mode }: CheckEmailNoticeProps) {
  const [cooldown, setCooldown] = useState(0)
  const [isResending, setIsResending] = useState(false)

  // Décrément du cooldown via interval (pas de Date.now() → ESLint purity OK).
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleResend = async () => {
    setIsResending(true)
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/dashboard",
    })
    setIsResending(false)

    if (error) {
      toast.error(mapAuthError(error).message)
      return
    }

    toast.success("Lien renvoyé. Vérifiez votre boîte courriel.")
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const title =
    mode === "signup"
      ? "Vérifiez votre boîte courriel"
      : "Confirmez votre adresse courriel"

  return (
    <div
      className="w-full space-y-5 text-center"
      data-testid="auth-check-email"
    >
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg">
        <Mail className="h-7 w-7 text-white" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
        {mode === "signup" ? (
          <p className="text-muted-foreground text-sm">
            Si <span className="font-medium">{email}</span> n&apos;est pas déjà
            associée à un compte, un lien de confirmation vient d&apos;y être
            envoyé. Cliquez-le pour activer votre compte.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Votre compte n&apos;est pas encore activé. Nous venons de renvoyer
            un lien de confirmation à{" "}
            <span className="font-medium">{email}</span>.
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full rounded-xl"
        onClick={handleResend}
        disabled={isResending || cooldown > 0}
        data-testid="auth-resend"
      >
        {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : "Renvoyer le lien"}
      </Button>

      {mode === "signup" && (
        <p className="text-muted-foreground text-sm">
          Vous avez déjà un compte ?{" "}
          <Link
            href="/connexion"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Connectez-vous
          </Link>
        </p>
      )}

      <p className="text-muted-foreground text-xs">
        Pas reçu ? Vérifiez vos indésirables.
      </p>
    </div>
  )
}
