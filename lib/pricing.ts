export type PricedProduct = {
  code: string
  /** En cents. */
  priceCAD: number
  durationDays: number
  accessType: "exam" | "training"
  isCombo: boolean
}

export type Savings = {
  /** Prix des mensuels équivalents, en cents. */
  referenceCAD: number
  savedCAD: number
  percent: number
}

/** Durée d'un accès mensuel du catalogue. */
export const MONTH_DAYS = 30

/**
 * Économie d'une formule par rapport aux accès mensuels qu'elle remplace,
 * sur la même durée : le Pack Premium couvre les deux accès. La référence se
 * lit dans le catalogue, jamais en dur : un prix modifié en base suit.
 */
export const savingsOf = (
  catalog: readonly PricedProduct[],
  product: PricedProduct,
): Savings | null => {
  const types = product.isCombo
    ? (["exam", "training"] as const)
    : [product.accessType]
  const months = product.durationDays / MONTH_DAYS

  let referenceCAD = 0
  for (const type of types) {
    const monthly = catalog.find(
      (p) =>
        !p.isCombo && p.accessType === type && p.durationDays === MONTH_DAYS,
    )
    if (!monthly) return null
    referenceCAD += monthly.priceCAD * months
  }

  const savedCAD = referenceCAD - product.priceCAD
  if (savedCAD <= 0) return null
  return {
    referenceCAD,
    savedCAD,
    percent: Math.floor((savedCAD / referenceCAD) * 100),
  }
}
