import { Compass, LayoutDashboard } from "lucide-react"
import Link from "next/link"
import { BackButton } from "@/components/shared/back-button"
import { StatusCard } from "@/components/shared/status-card"
import { Button } from "@/components/ui/button"

export default function AdminNotFound() {
  return (
    <div className="grid place-items-center py-8 md:py-12">
      <StatusCard
        icon={Compass}
        label="Erreur 404"
        title="Page admin introuvable"
        description="Cette page d'administration n'existe pas ou a été déplacée. Vérifiez l'adresse ou retournez au tableau de bord."
        actions={
          <>
            <Button asChild className="max-md:h-11">
              <Link href="/admin">
                <LayoutDashboard aria-hidden />
                Tableau de bord
              </Link>
            </Button>
            <BackButton />
          </>
        }
      />
    </div>
  )
}
