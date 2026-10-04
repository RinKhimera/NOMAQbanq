import type { AccessType } from "@/features/payments/access-ledger"
import type { AccessImpact } from "@/features/payments/dal"

export type ImpactLine = {
  accessType: AccessType
  /** L'accès est aujourd'hui actif et sera retiré ou raccourci. */
  affected: boolean
  /** Échéance actuelle (epoch ms), passée comprise ; null = aucune. */
  current: number | null
  /** Échéance après l'opération, encore future ; null = accès retiré. */
  after: number | null
}

/**
 * Ce qu'un retrait fera à chaque accès couvert par la transaction, à l'instant
 * `now` où l'aperçu a été chargé. Un accès déjà expiré n'est jamais « affecté » :
 * l'utilisateur ne perd rien.
 */
export const impactLines = (
  impacts: AccessImpact[],
  covered: AccessType[],
  now: number,
): ImpactLine[] =>
  impacts
    .filter((i) => covered.includes(i.accessType))
    .map((i) => {
      const current = i.currentAccessExpiresAt
      const restored = i.restoredExpiresAt
      return {
        accessType: i.accessType,
        affected: i.willAffectAccess && current !== null && current > now,
        current,
        after: restored !== null && restored > now ? restored : null,
      }
    })
