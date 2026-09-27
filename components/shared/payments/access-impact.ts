import type { AccessImpact } from "@/features/payments/dal"
import { formatExpiration } from "@/lib/format"

const ACCESS_LABEL: Record<AccessImpact["accessType"], string> = {
  exam: "aux examens",
  training: "à l'entraînement",
}

/** Types d'accès réellement perdus ou raccourcis : un accès déjà expiré ne l'est pas. */
export const affectedAccesses = (impacts: AccessImpact[], now: number) =>
  impacts.filter(
    (i) =>
      i.willAffectAccess &&
      i.currentAccessExpiresAt !== null &&
      i.currentAccessExpiresAt > now,
  )

export const describeAccessImpact = (
  impact: AccessImpact,
  action: "La suppression" | "Le remboursement",
  now: number,
) =>
  impact.restoredExpiresAt === null || impact.restoredExpiresAt <= now
    ? `${action} révoquera l'accès ${ACCESS_LABEL[impact.accessType]} de l'utilisateur : aucune autre transaction ne le couvre.`
    : `${action} ramènera l'accès ${ACCESS_LABEL[impact.accessType]} à son échéance précédente (${formatExpiration(impact.restoredExpiresAt)}).`
