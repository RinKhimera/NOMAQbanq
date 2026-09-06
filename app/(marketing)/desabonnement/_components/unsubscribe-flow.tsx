"use client"

import { BellOff, BellRing, MailCheck, MailX } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useState } from "react"
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
    className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
  >
    préférences de votre profil
  </Link>
)

const Card = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) => (
  <div className="flex min-h-[70vh] items-center justify-center bg-linear-to-br from-slate-50 via-white to-blue-50/30 px-4 py-16 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
    <div className="w-full max-w-lg rounded-3xl border border-gray-200/70 bg-white p-10 text-center shadow-xl dark:border-gray-700/60 dark:bg-gray-900">
      <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg">
        {icon}
      </div>
      <h1 className="font-display text-2xl font-bold text-balance text-gray-900 dark:text-white">
        {title}
      </h1>
      <div className="mt-4 space-y-6 text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </div>
  </div>
)

const iconClass = "h-8 w-8 text-white"

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
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  ) : null

  if (!token) {
    return (
      <Card
        icon={<MailX className={iconClass} />}
        title="Ce lien de désabonnement n'est pas valide"
      >
        <p>
          Il a peut-être été tronqué par votre messagerie. Vous pouvez gérer vos
          courriels depuis les <PreferencesLink />.
        </p>
      </Card>
    )
  }

  if (step === "resubscribed") {
    return (
      <Card
        icon={<BellRing className={iconClass} />}
        title="Vos rappels sont réactivés"
      >
        <p>
          Vous recevrez de nouveau nos rappels et suggestions. Vous pouvez
          changer d&apos;avis à tout moment depuis les <PreferencesLink />.
        </p>
      </Card>
    )
  }

  if (step === "unsubscribed") {
    return (
      <Card
        icon={<MailCheck className={iconClass} />}
        title="Vous ne recevrez plus nos rappels et suggestions"
      >
        <p>
          Les courriels liés à votre compte continueront d&apos;arriver. Vous
          avez changé d&apos;avis ? Réactivez-les ici, ou plus tard depuis les{" "}
          <PreferencesLink />.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="btn_modern_outline"
            size="lg"
            className="rounded-2xl px-8"
            onClick={() => run(resubscribeWithToken, "resubscribed")}
            disabled={busy}
          >
            {busy ? <Spinner size="sm" /> : null}
            Réactiver les rappels
          </Button>
          {errorLine}
        </div>
      </Card>
    )
  }

  return (
    <Card
      icon={<BellOff className={iconClass} />}
      title="Ne plus recevoir nos rappels et suggestions ?"
    >
      <p>
        Les courriels liés à votre compte (confirmation d&apos;achat, résultats
        d&apos;examen, fin d&apos;accès) continueront d&apos;arriver.
      </p>
      <div className="flex flex-col items-center gap-3">
        <Button
          variant="btn_modern"
          size="lg"
          className="rounded-2xl px-8"
          onClick={() => run(unsubscribeWithToken, "unsubscribed")}
          disabled={busy}
        >
          {busy ? <Spinner size="sm" /> : null}
          Me désabonner
        </Button>
        {errorLine}
        <Link
          href={PREFERENCES_HREF}
          className="text-sm text-gray-500 underline-offset-4 hover:underline dark:text-gray-400"
        >
          Gérer mes préférences
        </Link>
      </div>
    </Card>
  )
}
