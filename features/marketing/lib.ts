import { MARKETING_CLAIMS } from "@/constants"

// Score (%) minimal d'une participation « réussie ».
export const SUCCESS_SCORE_THRESHOLD = 60
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
  return `${rate}%`
}
