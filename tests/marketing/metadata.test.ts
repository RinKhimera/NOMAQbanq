import type { Metadata } from "next"
import { describe, expect, it, vi } from "vitest"
import * as aPropos from "@/app/(marketing)/a-propos/page"
import * as conditions from "@/app/(marketing)/conditions/page"
import * as confidentialite from "@/app/(marketing)/confidentialite/page"
import * as cookies from "@/app/(marketing)/cookies/page"
import * as domaineImage from "@/app/(marketing)/domaines/[slug]/opengraph-image"
import * as domaine from "@/app/(marketing)/domaines/[slug]/page"
import * as domaines from "@/app/(marketing)/domaines/page"
import * as guideImage from "@/app/(marketing)/eacmc-partie-1/opengraph-image"
import * as guide from "@/app/(marketing)/eacmc-partie-1/page"
import * as evaluation from "@/app/(marketing)/evaluation/page"
import * as faq from "@/app/(marketing)/faq/page"
import * as fonctionnement from "@/app/(marketing)/fonctionnement/page"
import * as accueil from "@/app/(marketing)/page"
import * as tarifs from "@/app/(marketing)/tarifs/page"
import { DOMAINS } from "@/constants/domains"
import { SITE_OG_ALT } from "@/lib/seo"

vi.mock("@/features/marketing/cached", () => ({}))
vi.mock("@/features/payments/dal", () => ({}))
vi.mock("@/lib/dal", () => ({}))
vi.mock("@/features/payments/actions", () => ({}))

const STATIC_PAGES: Record<string, Metadata> = {
  "/": accueil.metadata,
  "/domaines": domaines.metadata,
  "/fonctionnement": fonctionnement.metadata,
  "/eacmc-partie-1": guide.metadata,
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

  // Leur segment génère l'image de partage : une clé `images` l'écraserait.
  const SEGMENT_IMAGE = new Set(["/eacmc-partie-1"])

  it.each(Object.entries(STATIC_PAGES).filter(([p]) => !SEGMENT_IMAGE.has(p)))(
    "%s : un Open Graph redéfini porte une image",
    (_, m) => {
      expect(m.openGraph?.images).toBeTruthy()
    },
  )

  it.each(Object.entries(STATIC_PAGES))(
    "%s : un Open Graph propre, dont l'URL est le canonical",
    (_, m) => {
      expect(m.openGraph).toMatchObject({
        url: m.alternates?.canonical,
        siteName: "NOMAQbanq",
        locale: "fr_CA",
      })
    },
  )

  it.each(["/", "/domaines", "/tarifs"])("%s : le titre nomme l'EACMC", (p) => {
    expect(titleOf(STATIC_PAGES[p])).toMatch(/EACMC/)
  })

  it.each(
    Object.entries(STATIC_PAGES).filter(([p]) => p !== "/eacmc-partie-1"),
  )("%s : le titre ne porte pas l'ancien nom de l'examen", (_, m) => {
    expect(titleOf(m)).not.toMatch(/partie\s(I|1)\b/i)
  })

  it("le texte des images de partage ne porte pas l'ancien nom", () => {
    expect(SITE_OG_ALT).toMatch(/EACMC/)
    expect(SITE_OG_ALT).not.toMatch(/partie/i)
    expect(domaineImage.alt).not.toMatch(/partie/i)
  })

  it("le guide nomme l'EACMC sous son nom actuel et son ancien nom", () => {
    expect(titleOf(guide.metadata)).toMatch(/^EACMC \(anciennement Partie I\)/)
    expect(guide.metadata.description).toMatch(/partie 1/)
  })

  it("une seule page vise « préparer l'EACMC » : le guide", () => {
    expect(titleOf(fonctionnement.metadata)).not.toMatch(/préparer/i)
    expect(titleOf(guide.metadata)).toMatch(/préparation/)
  })

  it("le guide a sa propre image de partage", () => {
    expect(guide.metadata.openGraph).not.toHaveProperty("images")
    expect(guideImage.size).toEqual({ width: 1200, height: 630 })
    expect(guideImage.contentType).toBe("image/png")
    expect(guideImage.alt).toMatch(/EACMC/)
  })

  it.each(["/", "/domaines", "/tarifs", "/evaluation"])(
    "%s : la description reprend « partie 1 »",
    (p) => {
      expect(STATIC_PAGES[p].description).toMatch(/partie 1/)
    },
  )

  it.each(DOMAINS.map((d) => [d.slug, d.name]))(
    "/domaines/%s : titre dérivé du domaine, « EACMC », sans la marque",
    async (slug, name) => {
      const m = await domainMetadata(slug)
      expect(titleOf(m)).toBe(`${name} : QCM pour l'EACMC`)
      expect(m.description).toMatch(/partie 1/)
      expect(m.openGraph).toMatchObject({
        url: `https://nomaqbanq.ca/domaines/${slug}`,
      })
    },
  )

  it("les pages domaine ont une image de partage prérendue par slug", () => {
    expect(domaineImage.size).toEqual({ width: 1200, height: 630 })
    expect(domaineImage.contentType).toBe("image/png")
    expect(domaineImage.dynamicParams).toBe(false)
    expect(domaineImage.generateStaticParams()).toEqual(
      DOMAINS.map((d) => ({ slug: d.slug })),
    )
    // Avec `generateImageMetadata`, Next génère son propre
    // `generateStaticParams` : les images ne sont plus prérendues (404).
    expect(domaineImage).not.toHaveProperty("generateImageMetadata")
  })

  it("/domaines/autres reste servie mais hors index", async () => {
    expect((await domainMetadata("autres")).robots).toEqual({
      index: false,
      follow: true,
    })
    expect((await domainMetadata("cardiologie")).robots).toBeUndefined()
  })
})
