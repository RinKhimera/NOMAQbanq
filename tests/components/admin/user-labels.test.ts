import { describe, expect, it } from "vitest"
import {
  accessCellText,
  accessState,
  backfillDateLabel,
  isBackfilledLogin,
  loginMethodsLabel,
  userLabel,
} from "@/app/(admin)/admin/utilisateurs/_components/user-labels"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 8, 27, 15, 2)
const nb = (s: string) => s.replaceAll(" j", " j")

describe("accessState / accessCellText", () => {
  it("jamais eu, expiré, expire bientôt, actif", () => {
    expect(accessCellText(accessState(null, NOW))).toBe("—")
    expect(accessCellText(accessState(NOW - 10 * DAY, NOW))).toBe(
      "Expiré 17 sept.",
    )
    expect(accessCellText(accessState(NOW + 3 * DAY, NOW))).toBe(
      nb("Expire dans 3 j"),
    )
    expect(accessCellText(accessState(NOW + 20 * DAY, NOW))).toBe(
      nb("20 j restants"),
    )
  })

  it("7 jours pile : encore « expire bientôt »", () => {
    expect(accessState(NOW + 7 * DAY, NOW).state).toBe("expiring")
    expect(accessState(NOW + 7 * DAY + 1, NOW).state).toBe("active")
  })
})

describe("libellés de compte", () => {
  it("« Non défini » pour un compte sans nom", () => {
    expect(userLabel("  ")).toBe("Non défini")
    expect(userLabel("Nadia")).toBe("Nadia")
  })

  it("méthodes de connexion", () => {
    expect(loginMethodsLabel(["credential", "google"])).toBe(
      "Mot de passe, Google",
    )
  })

  it("valeur remplie d'office : la journée du 6 septembre 2026, heure de l'Est", () => {
    expect(isBackfilledLogin(Date.UTC(2026, 8, 6, 5, 14))).toBe(true)
    expect(isBackfilledLogin(Date.UTC(2026, 8, 7, 5, 14))).toBe(false)
    expect(backfillDateLabel()).toBe("6 sept. 2026")
  })
})
