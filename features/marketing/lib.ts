import { MARKETING_CLAIMS } from "@/constants"

// Volume minimal de participations terminées pour publier un taux calculé.
export const MIN_COMPLETED_PARTICIPATIONS = 50
// Plancher marketing : sous ce taux, on garde le claim éditorial (page de vente).
export const MIN_PUBLISHABLE_SUCCESS_RATE = 70

/**
 * Décide de la valeur affichée : le taux calculé arrondi, OU le claim éditorial
 * si le volume est insuffisant OU si le taux est sous le plancher de publication.
 */
export const resolveSuccessRate = ({
  completed,
  passed,
}: {
  completed: number
  passed: number
}): string => {
  if (completed < MIN_COMPLETED_PARTICIPATIONS) {
    return MARKETING_CLAIMS.successRate
  }
  const rate = Math.round((passed / completed) * 100)
  if (rate < MIN_PUBLISHABLE_SUCCESS_RATE) {
    return MARKETING_CLAIMS.successRate
  }
  // Espace insécable avant « % » (fr-CA), comme MARKETING_CLAIMS.
  return `${rate} %`
}

// Arrondit un nombre brut vers un palier marketing supérieur + suffixe "+".
// Ex: 167 → "200+", 2875 → "3000+".
export const formatMarketingStat = (n: number): string => {
  if (n <= 0) return "0"
  let step: number
  if (n < 200) step = 50
  else if (n < 1000) step = 100
  else if (n < 5000) step = 500
  else step = 1000
  return `${Math.ceil(n / step) * step}+`
}
