// Statuts après lesquels Stripe ne renvoie plus de changement d'état pour CE
// litige (`prevented` existe dans le SDK et est terminal).
export const TERMINAL_DISPUTE_STATUSES = [
  "won",
  "lost",
  "warning_closed",
  "prevented",
] as const

/**
 * Litige encore ouvert. Un statut inconnu compte comme ouvert : Stripe peut
 * ajouter des statuts, et un litige invisible coûte plus cher qu'une alerte de
 * trop.
 */
export const isOpenDispute = (status: string | null | undefined): boolean =>
  Boolean(status) &&
  !(TERMINAL_DISPUTE_STATUSES as readonly string[]).includes(status!)
