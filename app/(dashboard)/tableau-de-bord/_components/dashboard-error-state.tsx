import { ErrorState } from "@/components/shared/error-state"

/**
 * Rendu quand les statistiques sont introuvables. Remplace un squelette qui
 * pulsait indéfiniment : un squelette n'est jamais un état terminal.
 */
export const DashboardErrorState = () => (
  <ErrorState
    title="Impossible de charger vos statistiques"
    description="Une erreur est survenue pendant la récupération de vos données."
    retryHref="/tableau-de-bord"
  />
)
