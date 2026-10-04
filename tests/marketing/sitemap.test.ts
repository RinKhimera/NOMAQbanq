import { describe, expect, it } from "vitest"
import sitemap from "@/app/sitemap"

describe("sitemap", () => {
  it("référence les 22 pages domaine et la page Fonctionnement", () => {
    const urls = sitemap().map((entry) => entry.url)
    const domainPages = urls.filter((u) =>
      /^https:\/\/nomaqbanq\.ca\/domaines\/[a-z-]+$/.test(u),
    )
    expect(domainPages).toHaveLength(22)
    expect(domainPages).toContain(
      "https://nomaqbanq.ca/domaines/sante-publique",
    )
    expect(urls).toContain("https://nomaqbanq.ca/fonctionnement")
  })
})
