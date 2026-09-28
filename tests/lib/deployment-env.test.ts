import { describe, expect, it } from "vitest"
import { deploymentEnvLabel } from "@/lib/deployment-env"

describe("deploymentEnvLabel", () => {
  it.each([
    ["production", "Production"],
    ["preview", "Preview"],
    ["development", "Développement"],
  ])("VERCEL_ENV=%s → « %s »", (vercelEnv, label) => {
    expect(deploymentEnvLabel(vercelEnv)).toBe(label)
  })

  it("hors Vercel (bun dev), la variable est absente : développement", () => {
    expect(deploymentEnvLabel(undefined)).toBe("Développement")
  })

  it("affiche telle quelle une valeur inconnue plutôt que de la taire", () => {
    expect(deploymentEnvLabel("staging")).toBe("staging")
  })
})
