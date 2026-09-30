/**
 * Utilitaires pour le parsing et la validation des montants en devise
 */

export type Currency = "CAD" | "XAF"

const AMOUNT_PATTERN = /^\d+([.,]\d+)?$/

/**
 * Motif de refus d'un montant saisi, ou `null` s'il est valide pour la devise.
 * Zéro est valide : c'est la saisie d'un accès offert.
 */
export const amountInputError = (
  input: string,
  currency: Currency,
): string | null => {
  const trimmed = input.trim()
  if (!trimmed) return "Indiquez un montant (0 pour un accès offert)."
  if (!AMOUNT_PATTERN.test(trimmed))
    return "Le montant doit être positif ou nul."
  const decimals = trimmed.split(/[.,]/)[1]?.length ?? 0
  if (currency === "XAF" && decimals > 0)
    return "En XAF, le montant est un nombre entier."
  if (currency === "CAD" && decimals > 2)
    return "Deux décimales au plus en CAD."
  return null
}

/**
 * Montant saisi (virgule ou point) en centièmes, `null` s'il est invalide pour
 * la devise : entier en XAF, deux décimales au plus en CAD.
 */
export const parseAmountToCents = (
  input: string,
  currency: Currency,
): number | null => {
  if (amountInputError(input, currency)) return null
  return Math.round(Number(input.trim().replace(",", ".")) * 100)
}

/** Montant en centimes vers la valeur d'un champ de saisie, inverse de `parseAmountToCents`. */
export const centsToInputAmount = (
  cents: number,
  currency: Currency,
): string => {
  const amount = cents / 100
  return currency === "XAF" ? Math.round(amount).toString() : amount.toFixed(2)
}
