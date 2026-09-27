import { describe, expect, it } from "vitest"
import {
  affectedAccesses,
  describeAccessImpact,
} from "@/components/shared/payments/access-impact"
import type { AccessImpact } from "@/features/payments/dal"

const DAY = 24 * 60 * 60 * 1000
// 15 juin 2026, midi à Toronto : l'instant où l'aperçu a été chargé.
const NOW = Date.UTC(2026, 5, 15, 16)

const impact = (o: Partial<AccessImpact>): AccessImpact => ({
  accessType: "exam",
  willAffectAccess: true,
  currentAccessExpiresAt: NOW + 30 * DAY,
  restoredExpiresAt: null,
  ...o,
})

describe("affectedAccesses", () => {
  it("ne garde que les types d'accès touchés", () => {
    const list = affectedAccesses(
      [
        impact({ accessType: "exam", willAffectAccess: false }),
        impact({ accessType: "training" }),
      ],
      NOW,
    )
    expect(list.map((i) => i.accessType)).toEqual(["training"])
  })

  it("écarte un accès déjà expiré : l'utilisateur ne perd rien", () => {
    const list = affectedAccesses(
      [impact({ currentAccessExpiresAt: NOW - DAY })],
      NOW,
    )
    expect(list).toEqual([])
  })
})

describe("describeAccessImpact", () => {
  it("annonce la révocation quand aucune transaction ne couvre plus l'accès", () => {
    expect(
      describeAccessImpact(
        impact({ accessType: "training" }),
        "La suppression",
        NOW,
      ),
    ).toBe(
      "La suppression révoquera l'accès à l'entraînement de l'utilisateur : aucune autre transaction ne le couvre.",
    )
  })

  it("annonce l'échéance rétablie quand une autre transaction couvre encore", () => {
    expect(
      describeAccessImpact(
        impact({ restoredExpiresAt: NOW + DAY }),
        "Le remboursement",
        NOW,
      ),
    ).toBe(
      "Le remboursement ramènera l'accès aux examens à son échéance précédente (16 juin 2026).",
    )
  })

  it("annonce la révocation quand l'échéance rétablie est déjà passée", () => {
    expect(
      describeAccessImpact(
        impact({ restoredExpiresAt: NOW - DAY }),
        "La suppression",
        NOW,
      ),
    ).toBe(
      "La suppression révoquera l'accès aux examens de l'utilisateur : aucune autre transaction ne le couvre.",
    )
  })
})
