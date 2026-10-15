// Volume minimal de participations terminées pour publier un taux calculé.
export const MIN_COMPLETED_PARTICIPATIONS = 50
// Plancher de publication : sous ce taux, la vitrine n'en affiche aucun.
export const MIN_PUBLISHABLE_SUCCESS_RATE = 70

/**
 * Taux de réussite aux examens blancs, formaté, ou `null` quand il n'est pas
 * publiable : volume insuffisant ou taux sous le plancher. Aucun chiffre de
 * repli : sans taux calculé, la vitrine n'en montre pas.
 */
export const resolveSuccessRate = ({
  completed,
  passed,
}: {
  completed: number
  passed: number
}): string | null => {
  if (completed < MIN_COMPLETED_PARTICIPATIONS) return null
  // Plancher comparé au taux exact, puis arrondi vers le bas : un chiffre
  // public ne se présente jamais au-dessus du réel (69,5 % n'est pas 70 %).
  if (passed * 100 < MIN_PUBLISHABLE_SUCCESS_RATE * completed) return null
  const rate = Math.floor((passed * 100) / completed)
  // Espace insécable avant « % » (fr-CA).
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
