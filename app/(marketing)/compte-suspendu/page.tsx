import { Mail, ShieldOff } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { StatusCard, StatusScreen } from "@/components/shared/status-card"
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
    <StatusScreen>
      <StatusCard
        icon={ShieldOff}
        iconTone="danger"
        label="Compte suspendu"
        title="L'accès à ce compte a été suspendu"
        actions={
          <>
            <Button asChild className="max-md:h-11">
              <a href={`mailto:${supportEmail}`}>
                <Mail aria-hidden />
                Contacter le support
              </a>
            </Button>
            <Button asChild variant="outline" className="max-md:h-11">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </>
        }
        help="Nous répondons généralement sous 24 h."
      >
        <p className="text-ink-2 text-[15px] leading-[1.65]">
          L&apos;accès à ce compte a été suspendu par l&apos;équipe NOMAQbanq.
          Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, écrivez-nous
          à{" "}
          <a
            href={`mailto:${supportEmail}`}
            className="focus-ring text-accent-ink rounded-sm hover:underline"
          >
            {supportEmail}
          </a>
          .
        </p>
      </StatusCard>
    </StatusScreen>
  )
}
