/**
 * Utilitaires pour le parsing et la validation des montants en devise
 */

export type Currency = "CAD" | "XAF"

/**
 * Parse un montant saisi par l'utilisateur en centimes
 * Retourne null si invalide pour la devise donnée
 *
 * CAD: accepte les décimales (max 2), virgule ou point comme séparateur
 * XAF: doit être un entier (pas de centimes)
 */
export const parseAmountToCents = (
  input: string,
  currency: Currency,
): number | null => {
  if (!input || input.trim() === "") return null

  const normalized = input.replace(",", ".").trim()
  const num = parseFloat(normalized)

  if (isNaN(num) || !isFinite(num) || num <= 0) return null

  if (currency === "XAF") {
    // XAF n'a pas de centimes - doit être un entier
    if (!Number.isInteger(num)) return null
    return num * 100
  } else {
    // CAD: max 2 décimales
    const decimalPart = normalized.split(".")[1]
    const decimalPlaces = decimalPart ? decimalPart.length : 0
    if (decimalPlaces > 2) return null
    return Math.round(num * 100)
  }
}

/**
 * Valide si un montant est valide pour une devise donnée
 */
export const isValidAmount = (input: string, currency: Currency): boolean => {
  return parseAmountToCents(input, currency) !== null
}
