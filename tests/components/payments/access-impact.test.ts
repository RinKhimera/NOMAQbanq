import { describe, expect, it } from "vitest"
import {
  affectedAccesses,
  describeAccessImpact,
} from "@/components/shared/payments/access-impact"
import type { AccessImpact } from "@/features/payments/dal"

// 15 juin 2026, midi à Toronto.
const JUNE_15 = Date.UTC(2026, 5, 15, 16)

const impact = (o: Partial<AccessImpact>): AccessImpact => ({
  accessType: "exam",
  willAffectAccess: true,
  currentAccessExpiresAt: JUNE_15 + 1,
  restoredExpiresAt: null,
  ...o,
})

describe("affectedAccesses", () => {
  it("ne garde que les types d'accès touchés", () => {
    const list = affectedAccesses([
      impact({ accessType: "exam", willAffectAccess: false }),
      impact({ accessType: "training" }),
    ])
    expect(list.map((i) => i.accessType)).toEqual(["training"])
  })

  it("aperçu pas encore chargé → aucun impact", () => {
    expect(affectedAccesses(null)).toEqual([])
  })
})

describe("describeAccessImpact", () => {
  it("annonce la révocation quand aucune transaction ne couvre plus l'accès", () => {
    expect(
      describeAccessImpact(
        impact({ accessType: "training" }),
        "La suppression",
      ),
    ).toBe(
      "La suppression révoquera l'accès à l'entraînement de l'utilisateur : aucune autre transaction ne le couvre.",
    )
  })

  it("annonce l'échéance rétablie quand une autre transaction couvre encore", () => {
    expect(
      describeAccessImpact(
        impact({ restoredExpiresAt: JUNE_15 }),
        "Le remboursement",
      ),
    ).toBe(
      "Le remboursement ramènera l'accès aux examens à son échéance précédente (15 juin 2026).",
    )
  })
})
