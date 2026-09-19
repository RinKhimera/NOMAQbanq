/**
 * Erreur de configuration du port Stripe (clé ou secret de webhook absent).
 * Hors du port lui-même, qui n'exporte que ses verbes : la route la distingue
 * d'une signature invalide (500 à rejouer, pas 400), et le checkout d'une
 * panne de lecture (pas de repli sur `stripe_price_id`).
 */
export class StripeConfigurationError extends Error {
  override readonly name = "StripeConfigurationError"
  constructor(variable: string) {
    super(`Configuration Stripe manquante (${variable})`)
  }
}

// Par `name` et non `instanceof` : robuste à une double instance de module
// (bundles séparés, module remplacé en test).
export const isStripeConfigurationError = (error: unknown): boolean =>
  error instanceof Error && error.name === "StripeConfigurationError"
