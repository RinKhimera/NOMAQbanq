import { ShieldOff } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { env } from "@/lib/env/server"

export const metadata: Metadata = {
  title: "Compte suspendu",
  robots: { index: false, follow: false },
}

// Même adresse que le pied de page quand SUPPORT_EMAIL n'est pas configurée.
const FALLBACK_SUPPORT_EMAIL = "nomaqbanq@outlook.com"

// Page publique, sans session : un compte suspendu n'en a plus. Elle ne sait
// pas qui la regarde et n'affiche jamais le motif (interne à l'équipe).
export default function SuspendedPage() {
  const supportEmail = env.SUPPORT_EMAIL ?? FALLBACK_SUPPORT_EMAIL

  return (
    <div className="theme-bg">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl border border-white/20 p-8 text-center shadow-2xl dark:border-gray-700/50">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-red-500 to-rose-600 shadow-lg">
            <ShieldOff className="h-8 w-8 text-white" aria-hidden="true" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
            Compte suspendu
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            L&apos;accès à ce compte a été suspendu par l&apos;équipe NOMAQbanq.
            Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur,
            écrivez-nous à{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-blue-600 underline dark:text-blue-400"
            >
              {supportEmail}
            </a>
            .
          </p>
          <Button asChild variant="outline" className="mt-8 rounded-xl">
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
