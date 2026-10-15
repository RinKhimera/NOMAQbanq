import { describe, expect, it } from "vitest"
import { GUIDE_REVIEWED_ON } from "@/app/(marketing)/eacmc-partie-1/_data/guide"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"

const urls = () => sitemap().map((entry) => entry.url)

describe("sitemap", () => {
  it("référence les 21 pages domaine indexables et la page Fonctionnement", () => {
    const domainPages = urls().filter((u) =>
      /^https:\/\/nomaqbanq\.ca\/domaines\/[a-z-]+$/.test(u),
    )
    expect(domainPages).toHaveLength(21)
    expect(domainPages).toContain(
      "https://nomaqbanq.ca/domaines/sante-publique",
    )
    expect(urls()).toContain("https://nomaqbanq.ca/fonctionnement")
  })

  it("date le guide de sa dernière révision factuelle", () => {
    const entry = sitemap().find(
      (e) => e.url === "https://nomaqbanq.ca/eacmc-partie-1",
    )
    expect(entry?.lastModified).toEqual(new Date(GUIDE_REVIEWED_ON))
  })

  it("ne liste pas la page des questions transversales", () => {
    expect(urls()).not.toContain("https://nomaqbanq.ca/domaines/autres")
  })
})

describe("robots", () => {
  it("laisse la vitrine ouverte et pointe le sitemap", () => {
    const rules = robots()
    expect(rules.sitemap).toBe("https://nomaqbanq.ca/sitemap.xml")
    expect(rules.rules).toMatchObject([{ userAgent: "*", allow: "/" }])
  })
})
