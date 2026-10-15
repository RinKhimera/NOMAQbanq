import { describe, expect, it } from "vitest"
import { domainBySlug } from "@/constants/domains"
import type { ProductView } from "@/features/payments/dal"
import {
  domainBreadcrumbJsonLd,
  faqPageJsonLd,
  offersJsonLd,
  organizationJsonLd,
  pageMetadata,
  websiteJsonLd,
} from "@/lib/seo"

const product = (over: Partial<ProductView>): ProductView => ({
  id: "p1",
  code: "exam_access",
  name: "Accès Examens",
  description: "Examens blancs",
  priceCAD: 5000,
  durationDays: 30,
  accessType: "exam",
  isCombo: false,
  ...over,
})

describe("domainBreadcrumbJsonLd", () => {
  it("suit le fil d'Ariane visible : Accueil › Domaines › domaine", () => {
    const cardio = domainBySlug("cardiologie")!
    const data = domainBreadcrumbJsonLd(cardio)

    expect(data["@type"]).toBe("BreadcrumbList")
    expect(data.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: "https://nomaqbanq.ca",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Domaines",
        item: "https://nomaqbanq.ca/domaines",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Cardiologie",
        item: "https://nomaqbanq.ca/domaines/cardiologie",
      },
    ])
  })
})

describe("offersJsonLd", () => {
  it("une offre par produit, prix et devise lus dans le catalogue", () => {
    const data = offersJsonLd([
      product({ id: "a", name: "Accès Examens", priceCAD: 5000 }),
      product({ id: "b", name: "Pack Premium", priceCAD: 35050 }),
    ])

    expect(data?.offers).toEqual([
      expect.objectContaining({
        "@type": "Offer",
        name: "Accès Examens",
        price: "50.00",
        priceCurrency: "CAD",
        url: "https://nomaqbanq.ca/tarifs",
      }),
      expect.objectContaining({
        "@type": "Offer",
        name: "Pack Premium",
        price: "350.50",
        priceCurrency: "CAD",
      }),
    ])
  })
})

describe("offersJsonLd : image du produit", () => {
  it("porte une image absolue, exigée par les fiches marchand de Google", () => {
    expect(offersJsonLd([product({})])?.image).toBe(
      "https://nomaqbanq.ca/opengraph-image",
    )
  })
})

describe("offersJsonLd sans produit", () => {
  it("ne produit rien : un Product sans offre est invalide", () => {
    expect(offersJsonLd([])).toBeNull()
  })
})

describe("faqPageJsonLd", () => {
  it("une Question par entrée, avec sa réponse", () => {
    expect(faqPageJsonLd([{ q: "Pourquoi ?", a: "Parce que." }])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Pourquoi ?",
          acceptedAnswer: { "@type": "Answer", text: "Parce que." },
        },
      ],
    })
  })
})

describe("pageMetadata", () => {
  it("l'accueil a pour URL la racine du site, sans barre finale", () => {
    const m = pageMetadata("/", { title: "Accueil", description: "…" })
    expect(m.alternates?.canonical).toBe("https://nomaqbanq.ca")
    expect(m.openGraph).toMatchObject({ url: "https://nomaqbanq.ca" })
  })

  it("sans image quand le segment génère la sienne", () => {
    const m = pageMetadata("/domaines/cardiologie", {
      title: "Cardiologie",
      description: "…",
      ogImage: false,
    })
    expect(m.openGraph).not.toHaveProperty("images")
  })
})

describe("organizationJsonLd", () => {
  it("porte l'adresse de Gatineau et un logo matriciel", () => {
    const data = organizationJsonLd()

    expect(data.address).toMatchObject({
      "@type": "PostalAddress",
      addressLocality: "Gatineau",
      addressRegion: "QC",
      addressCountry: "CA",
    })
    expect(data.logo).toMatch(/^https:\/\/nomaqbanq\.ca\/.+\.png$/)
    expect(String(data.description)).not.toMatch(/première/i)
  })
})

describe("websiteJsonLd", () => {
  it("n'annonce aucune recherche interne", () => {
    expect(websiteJsonLd()).not.toHaveProperty("potentialAction")
  })
})
