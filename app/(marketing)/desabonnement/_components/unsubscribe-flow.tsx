"use client"

import Link from "next/link"
import { useState } from "react"
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
  <Link href={PREFERENCES_HREF} className="underline">
    préférences de votre profil
  </Link>
)

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

  if (!token) {
    return (
      <section className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">
          Ce lien de désabonnement n&apos;est pas valide
        </h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          Vous pouvez gérer vos courriels depuis les <PreferencesLink />.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-lg px-4 py-24 text-center">
      {step === "prompt" ? (
        <>
          <h1 className="font-display text-2xl font-bold">
            Ne plus recevoir nos rappels et suggestions ?
          </h1>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            Les courriels liés à votre compte (confirmation d&apos;achat,
            résultats d&apos;examen, fin d&apos;accès) continueront
            d&apos;arriver.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              onClick={() => run(unsubscribeWithToken, "unsubscribed")}
              disabled={busy}
            >
              {busy ? <Spinner size="sm" /> : null}
              Me désabonner
            </Button>
          </div>
        </>
      ) : step === "unsubscribed" ? (
        <>
          <h1 className="font-display text-2xl font-bold">
            Vous ne recevrez plus nos rappels et suggestions
          </h1>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            Vous avez changé d&apos;avis ? Réactivez-les ici, ou plus tard
            depuis les <PreferencesLink />.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              variant="outline"
              onClick={() => run(resubscribeWithToken, "resubscribed")}
              disabled={busy}
            >
              {busy ? <Spinner size="sm" /> : null}
              Réactiver les rappels
            </Button>
          </div>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-bold">
            Vos rappels sont réactivés
          </h1>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            Vous recevrez de nouveau nos rappels et suggestions. Vous pouvez
            changer d&apos;avis à tout moment depuis les <PreferencesLink />.
          </p>
        </>
      )}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </section>
  )
}
