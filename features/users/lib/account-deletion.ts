// Fenêtre de grâce avant anonymisation définitive d'un compte supprimé.
export const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000

// Vrai si la suppression douce (`deletedAt`) a dépassé la fenêtre de grâce.
export function isGraceExpired(
  deletedAt: Date | null | undefined,
  now: number,
): boolean {
  if (!deletedAt) return false
  return now - deletedAt.getTime() >= DELETION_GRACE_MS
}
