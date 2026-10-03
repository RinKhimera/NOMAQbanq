import { Compass, House } from "lucide-react"
import Link from "next/link"
import { BackButton } from "@/components/shared/back-button"
import { StatusCard } from "@/components/shared/status-card"
import { Button } from "@/components/ui/button"

export default function DashboardNotFound() {
  return (
    <div className="grid place-items-center py-8 md:py-12">
      <StatusCard
        icon={Compass}
        label="Erreur 404"
        title="Page introuvable"
        description="Cette page n'existe pas ou a été déplacée. Retournez à votre tableau de bord pour continuer."
        actions={
          <>
            <Button asChild className="max-md:h-11">
              <Link href="/tableau-de-bord">
                <House aria-hidden />
                Mon tableau de bord
              </Link>
            </Button>
            <BackButton />
          </>
        }
      />
    </div>
  )
}
