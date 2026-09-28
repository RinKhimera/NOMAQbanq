"use client"

import { BellOff, BellRing, MailCheck, MailX } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { StatusCard, StatusScreen } from "@/components/shared/status-card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  resubscribeWithToken,
  unsubscribeWithToken,
} from "@/features/notifications/actions"
import { callAction } from "@/lib/safe-action"

const PREFERENCES_HREF = "/tableau-de-bord/profil"

type Step = "prompt" | "unsubscribed" | "resubscribed"

const PreferencesLink = () => (
  <Link
    href={PREFERENCES_HREF}
    className="focus-ring text-accent-ink rounded-sm hover:underline"
  >
    préférences de votre profil
  </Link>
)

const TEXT = "text-ink-2 text-[15px] leading-[1.65]"

export function UnsubscribeFlow({ token }: { token: string | null }) {
  const [step, setStep] = useState<Step>("prompt")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: typeof unsubscribeWithToken, next: Step) => {
    if (!token) return
    setBusy(true)
    setError(null)
    const res = await callAction(() => action({ token }))
    setBusy(false)
    if (!res.success) {
      setError(res.error ?? "Échec de la demande")
      return
    }
    setStep(next)
  }

  const errorLine = error ? (
    <p role="alert" className="text-danger-ink w-full text-sm">
      {error}
    </p>
  ) : null

  if (!token) {
    return (
      <StatusScreen>
        <StatusCard
          icon={MailX}
          iconTone="danger"
          label="Lien invalide"
          title="Ce lien de désabonnement n'est pas valide"
        >
          <p className={TEXT}>
            Il a peut-être été tronqué par votre messagerie. Vous pouvez gérer
            vos courriels depuis les <PreferencesLink />.
          </p>
        </StatusCard>
      </StatusScreen>
    )
  }

  if (step === "resubscribed") {
    return (
      <StatusScreen>
        <StatusCard
          icon={BellRing}
          iconTone="success"
          label="Rappels réactivés"
          title="Vos rappels sont réactivés"
          focusTitle
        >
          <p className={TEXT}>
            Vous recevrez de nouveau nos rappels et suggestions. Vous pouvez
            changer d&apos;avis à tout moment depuis les <PreferencesLink />.
          </p>
        </StatusCard>
      </StatusScreen>
    )
  }

  if (step === "unsubscribed") {
    return (
      <StatusScreen>
        <StatusCard
          icon={MailCheck}
          iconTone="success"
          label="Désabonnement confirmé"
          title="Vous ne recevrez plus nos rappels et suggestions"
          focusTitle
          actions={
            <>
              <Button
                variant="outline"
                className="max-md:h-11"
                onClick={() => run(resubscribeWithToken, "resubscribed")}
                disabled={busy}
              >
                {busy ? <Spinner size="sm" /> : null}
                Réactiver les rappels
              </Button>
              {errorLine}
            </>
          }
        >
          <p className={TEXT}>
            Les courriels liés à votre compte continueront d&apos;arriver. Vous
            avez changé d&apos;avis ? Réactivez-les ici, ou plus tard depuis les{" "}
            <PreferencesLink />.
          </p>
        </StatusCard>
      </StatusScreen>
    )
  }

  return (
    <StatusScreen>
      <StatusCard
        icon={BellOff}
        label="Courriels"
        title="Ne plus recevoir nos rappels et suggestions ?"
        actions={
          <>
            <Button
              className="max-md:h-11"
              onClick={() => run(unsubscribeWithToken, "unsubscribed")}
              disabled={busy}
            >
              {busy ? <Spinner size="sm" /> : null}
              Me désabonner
            </Button>
            <Button asChild variant="ghost" className="max-md:h-11">
              <Link href={PREFERENCES_HREF}>Gérer mes préférences</Link>
            </Button>
            {errorLine}
          </>
        }
      >
        <p className={TEXT}>
          Les courriels liés à votre compte (confirmation d&apos;achat,
          résultats d&apos;examen, fin d&apos;accès) continueront
          d&apos;arriver.
        </p>
      </StatusCard>
    </StatusScreen>
  )
}
