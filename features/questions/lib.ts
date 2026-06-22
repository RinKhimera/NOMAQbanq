// Normalise un objectif CMC : trim + majuscule initiale (parité avec l'ancien
// `normalizeObjectifCMC` Convex). Pur (utilisable client + serveur).
export const normalizeObjectifCMC = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}
