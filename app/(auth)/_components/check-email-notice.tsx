"use client"

import { MailCheck } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { mapAuthError } from "@/lib/auth-errors"
import { AuthCard } from "./auth-card"

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
      callbackURL: "/tableau-de-bord",
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
    <AuthCard
      title={title}
      icon={MailCheck}
      focusTitle
      data-testid="auth-check-email"
    >
      {mode === "signup" ? (
        <p className="text-ink-2 text-[15px] leading-relaxed">
          Si <strong className="text-ink font-medium">{email}</strong>{" "}
          n&apos;est pas déjà associée à un compte, un lien de confirmation
          vient d&apos;y être envoyé. Cliquez-le pour activer votre compte.
        </p>
      ) : (
        <p className="text-ink-2 text-[15px] leading-relaxed">
          Votre compte n&apos;est pas encore activé. Nous venons de renvoyer un
          lien de confirmation à{" "}
          <strong className="text-ink font-medium">{email}</strong>.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full max-md:h-11"
        onClick={handleResend}
        disabled={isResending || cooldown > 0}
        data-testid="auth-resend"
      >
        {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : "Renvoyer le lien"}
      </Button>

      {mode === "signup" && (
        <p className="text-ink-3 text-sm">
          Vous avez déjà un compte ?{" "}
          <Link
            href="/connexion"
            className="focus-ring text-accent-ink rounded-sm hover:underline"
          >
            Connectez-vous
          </Link>
        </p>
      )}

      <p className="text-ink-3 text-[13px]">
        Rien reçu ? Vérifiez vos courriels indésirables.
      </p>
    </AuthCard>
  )
}
