import { describe, expect, it } from "vitest"
import { disputeBadge } from "@/components/shared/payments/dispute-badge"

describe("disputeBadge", () => {
  it("aucun litige → pas de badge", () => {
    expect(disputeBadge(null)).toBeNull()
    expect(disputeBadge(undefined)).toBeNull()
  })

  it("litige en cours → rouge, quel que soit le statut non terminal", () => {
    for (const status of [
      "needs_response",
      "under_review",
      "warning_needs_response",
      "warning_under_review",
    ]) {
      expect(disputeBadge(status)).toEqual({
        label: "Litige en cours",
        tone: "danger",
      })
    }
  })

  it("gagné et évité → vert ; perdu et enquête close → gris", () => {
    expect(disputeBadge("won")).toEqual({
      label: "Litige gagné",
      tone: "success",
    })
    expect(disputeBadge("prevented")).toEqual({
      label: "Litige évité",
      tone: "success",
    })
    expect(disputeBadge("lost")).toEqual({
      label: "Litige perdu",
      tone: "muted",
    })
    expect(disputeBadge("warning_closed")).toEqual({
      label: "Enquête close",
      tone: "muted",
    })
  })

  it("statut inconnu → rouge (mieux vaut un faux « en cours » qu'un litige invisible)", () => {
    expect(disputeBadge("statut_futur")).toEqual({
      label: "Litige en cours",
      tone: "danger",
    })
  })
})
