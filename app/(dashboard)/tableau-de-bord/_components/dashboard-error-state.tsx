import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * Rendu quand les statistiques sont introuvables. Remplace un squelette qui
 * pulsait indéfiniment : un squelette n'est jamais un état terminal.
 */
export const DashboardErrorState = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
      Impossible de charger vos statistiques
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      Une erreur est survenue pendant la récupération de vos données.
    </p>
    <Button asChild>
      <Link href="/tableau-de-bord">Réessayer</Link>
    </Button>
  </div>
)
