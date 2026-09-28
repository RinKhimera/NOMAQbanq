import { Clock, UserX } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { StatusCard, StatusScreen } from "@/components/shared/status-card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Compte désactivé",
  robots: { index: false, follow: false },
}

export default function CompteSupprimePage() {
  return (
    <StatusScreen>
      <StatusCard
        icon={UserX}
        label="Compte désactivé"
        title="Votre compte a été désactivé"
        actions={
          <>
            <Button asChild className="max-md:h-11">
              <Link href="/connexion">Se reconnecter</Link>
            </Button>
            <Button asChild variant="ghost" className="max-md:h-11">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </>
        }
        help={
          <>
            Une question ? Écrivez-nous à{" "}
            <a
              href="mailto:nomaqbanq@outlook.com"
              className="focus-ring text-accent-ink rounded-sm hover:underline"
            >
              nomaqbanq@outlook.com
            </a>
            .
          </>
        }
      >
        <p className="text-ink-2 text-[15px] leading-[1.65]">
          Vous avez 30 jours pour le réactiver : reconnectez-vous simplement
          avec vos identifiants avant la fin du délai. Passé cette date, vos
          données personnelles seront définitivement anonymisées.
        </p>
        <p className="bg-surface-2 border-line text-ink flex items-center gap-2.5 rounded-md border px-3.5 py-3 font-mono text-[13px]">
          <Clock aria-hidden className="text-warning size-4" />
          30j pour réactiver
        </p>
      </StatusCard>
    </StatusScreen>
  )
}
