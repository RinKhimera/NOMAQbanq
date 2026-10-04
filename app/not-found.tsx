import { Compass, House } from "lucide-react"
import Link from "next/link"
import { BackButton } from "@/components/shared/back-button"
import { MarketingShell } from "@/components/shared/marketing-shell"
import { StatusCard, StatusScreen } from "@/components/shared/status-card"
import { Button } from "@/components/ui/button"

const helpLink = "focus-ring text-accent-ink rounded-sm hover:underline"

export default function NotFound() {
  return (
    <MarketingShell>
      <StatusScreen>
        <StatusCard
          icon={Compass}
          label="Erreur 404"
          title="Page introuvable"
          actions={
            <>
              <Button asChild className="max-md:h-11">
                <Link href="/">
                  <House aria-hidden />
                  Retour à l&apos;accueil
                </Link>
              </Button>
              <BackButton />
            </>
          }
          help={
            <>
              Vous cherchiez à vous entraîner ?{" "}
              <Link href="/evaluation" className={helpLink}>
                Essayez l&apos;évaluation gratuite
              </Link>{" "}
              ou{" "}
              <Link href="/domaines" className={helpLink}>
                parcourez les domaines
              </Link>
              .
            </>
          }
        >
          <p className="text-ink-2 text-[15px] leading-[1.65]">
            Nous n&apos;avons pas trouvé la page que vous cherchez. Elle a
            peut-être été déplacée ou supprimée.
          </p>
        </StatusCard>
      </StatusScreen>
    </MarketingShell>
  )
}
