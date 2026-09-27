import type { AccessImpact } from "@/features/payments/dal"
import { formatExpiration } from "@/lib/format"

const ACCESS_LABEL: Record<AccessImpact["accessType"], string> = {
  exam: "aux examens",
  training: "à l'entraînement",
}

export const affectedAccesses = (impacts: AccessImpact[] | null) =>
  impacts?.filter((i) => i.willAffectAccess) ?? []

export const describeAccessImpact = (
  impact: AccessImpact,
  action: "La suppression" | "Le remboursement",
) =>
  impact.restoredExpiresAt === null
    ? `${action} révoquera l'accès ${ACCESS_LABEL[impact.accessType]} de l'utilisateur : aucune autre transaction ne le couvre.`
    : `${action} ramènera l'accès ${ACCESS_LABEL[impact.accessType]} à son échéance précédente (${formatExpiration(impact.restoredExpiresAt)}).`
