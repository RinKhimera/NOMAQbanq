import type { Metadata } from "next"
import { describe, expect, it, vi } from "vitest"
import * as aPropos from "@/app/(marketing)/a-propos/page"
import * as conditions from "@/app/(marketing)/conditions/page"
import * as confidentialite from "@/app/(marketing)/confidentialite/page"
import * as cookies from "@/app/(marketing)/cookies/page"
import * as domaineImage from "@/app/(marketing)/domaines/[slug]/opengraph-image"
import * as domaine from "@/app/(marketing)/domaines/[slug]/page"
import * as domaines from "@/app/(marketing)/domaines/page"
import * as evaluation from "@/app/(marketing)/evaluation/page"
import * as faq from "@/app/(marketing)/faq/page"
import * as fonctionnement from "@/app/(marketing)/fonctionnement/page"
import * as accueil from "@/app/(marketing)/page"
import * as tarifs from "@/app/(marketing)/tarifs/page"
import { DOMAINS } from "@/constants/domains"

vi.mock("@/features/marketing/cached", () => ({}))
vi.mock("@/features/payments/dal", () => ({}))
vi.mock("@/lib/dal", () => ({}))
vi.mock("@/features/payments/actions", () => ({}))

const STATIC_PAGES: Record<string, Metadata> = {
  "/": accueil.metadata,
  "/domaines": domaines.metadata,
  "/fonctionnement": fonctionnement.metadata,
  "/tarifs": tarifs.metadata,
  "/evaluation": evaluation.metadata,
  "/faq": faq.metadata,
  "/a-propos": aPropos.metadata,
  "/conditions": conditions.metadata,
  "/confidentialite": confidentialite.metadata,
  "/cookies": cookies.metadata,
}

const domainMetadata = (slug: string) =>
  domaine.generateMetadata({ params: Promise.resolve({ slug }) })

const titleOf = (m: Metadata) => String(m.title)

describe("metadata de la vitrine", () => {
  it.each(Object.entries(STATIC_PAGES))(
    "%s : titre sans la marque (le gabarit l'ajoute)",
    (_, m) => {
      expect(titleOf(m)).not.toMatch(/NOMAQbanq/i)
    },
  )

  it.each(Object.entries(STATIC_PAGES).filter(([, m]) => m.openGraph))(
    "%s : un Open Graph redéfini porte une image",
    (_, m) => {
      expect(m.openGraph?.images).toBeTruthy()
    },
  )

  it.each(["/tarifs", "/fonctionnement"])(
    "%s : le titre nomme l'EACMC",
    (p) => {
      expect(titleOf(STATIC_PAGES[p])).toMatch(/EACMC Partie I/)
    },
  )

  it.each(["/", "/domaines", "/tarifs", "/evaluation"])(
    "%s : la description reprend « partie 1 »",
    (p) => {
      expect(STATIC_PAGES[p].description).toMatch(/partie 1/)
    },
  )

  it.each(DOMAINS.map((d) => [d.slug, d.name]))(
    "/domaines/%s : titre dérivé du domaine, « EACMC Partie I », sans la marque",
    async (slug, name) => {
      const m = await domainMetadata(slug)
      expect(titleOf(m)).toBe(`${name} : QCM pour l'EACMC Partie I`)
      expect(m.description).toMatch(/partie 1/)
    },
  )

  it("les pages domaine ont leur image de partage générée", () => {
    expect(domaineImage.size).toEqual({ width: 1200, height: 630 })
    expect(domaineImage.contentType).toBe("image/png")
  })

  it("/domaines/autres reste servie mais hors index", async () => {
    expect((await domainMetadata("autres")).robots).toEqual({
      index: false,
      follow: true,
    })
    expect((await domainMetadata("cardiologie")).robots).toBeUndefined()
  })
})
