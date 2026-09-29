import { describe, expect, it } from "vitest"
import { MEDICAL_DOMAINS } from "@/constants"
import { DOMAINS, domainBySlug } from "@/constants/domains"

describe("domaines publics", () => {
  it("retrouve un domaine par le slug de la maquette", () => {
    const domain = domainBySlug("sante-publique")
    expect(domain?.name).toBe("Santé publique et médecine préventive")
    expect(domain?.group.label).toBe("Santé mentale et populationnelle")
  })

  it("ne retrouve rien pour un slug inconnu", () => {
    expect(domainBySlug("dentisterie")).toBeUndefined()
  })

  it("couvre chacun des 22 domaines de la banque une seule fois, « Autres » compris", () => {
    expect(DOMAINS).toHaveLength(22)
    expect(DOMAINS.map((d) => d.name).toSorted()).toEqual(
      [...MEDICAL_DOMAINS].toSorted(),
    )
  })
})
