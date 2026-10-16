import type { Metadata } from "next"
import { MARKETING_PATHS } from "@/constants"
import { type PublicDomain, domainPath } from "@/constants/domains"
import type { ProductView } from "@/features/payments/dal"

export const SITE_URL = "https://nomaqbanq.ca"

export const SITE_DESCRIPTION =
  "Plateforme francophone de préparation à l'EACMC Partie I : plus de 3000 QCM, examens blancs et suivi de progression."

/**
 * Une page qui redéfinit `openGraph` remplace celui du layout racine au lieu
 * de le compléter : elle repart de `SITE_OPEN_GRAPH`, pose son `url` et
 * reprend l'image du site, sauf si son segment en génère une. Une clé
 * `images` l'emporte sur le fichier `opengraph-image` du même segment.
 */
export const SITE_OPEN_GRAPH = {
  type: "website",
  locale: "fr_CA",
  siteName: "NOMAQbanq",
} as const

export const OG_SIZE = { width: 1200, height: 630 }

export const SITE_OG_ALT = "NOMAQbanq, préparation à l'EACMC Partie I"

/** Générée par `app/opengraph-image.tsx`. */
export const SITE_OG_IMAGE = {
  url: "/opengraph-image",
  ...OG_SIZE,
  alt: SITE_OG_ALT,
}

export const siteUrl = (path: string) =>
  path === MARKETING_PATHS.home ? SITE_URL : `${SITE_URL}${path}`

/**
 * Métadonnées d'une page de la vitrine : canonical et Open Graph complet sur
 * la même URL. `ogImage: false` quand le segment génère sa propre image.
 */
export const pageMetadata = (
  path: string,
  {
    title,
    description,
    ogTitle = title,
    ogDescription = description,
    ogImage = true,
  }: {
    title: string
    description: string
    ogTitle?: string
    ogDescription?: string
    ogImage?: boolean
  },
): Metadata => {
  const url = siteUrl(path)
  return {
    title,
    description,
    alternates: { canonical: url, languages: { "fr-CA": url } },
    openGraph: {
      ...SITE_OPEN_GRAPH,
      url,
      title: ogTitle,
      description: ogDescription,
      ...(ogImage && { images: [SITE_OG_IMAGE] }),
    },
  }
}

export type JsonLdData = {
  "@context": "https://schema.org"
  "@type": string
  [key: string]: unknown
}

const ORGANIZATION = {
  "@type": "EducationalOrganization",
  name: "NOMAQbanq",
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
} as const

export const organizationJsonLd = (): JsonLdData => ({
  "@context": "https://schema.org",
  ...ORGANIZATION,
  description: SITE_DESCRIPTION,
  address: {
    "@type": "PostalAddress",
    streetAddress: "114 rue Isabelle",
    addressLocality: "Gatineau",
    addressRegion: "QC",
    postalCode: "J8Y 5H3",
    addressCountry: "CA",
  },
  contactPoint: {
    "@type": "ContactPoint",
    email: "nomaqbanq@outlook.com",
    telephone: "+1-438-875-0746",
    contactType: "customer service",
    availableLanguage: "French",
  },
})

export const websiteJsonLd = (): JsonLdData => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "NOMAQbanq",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "fr-CA",
})

export const domainBreadcrumbJsonLd = (domain: PublicDomain): JsonLdData => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { name: "Accueil", item: SITE_URL },
    { name: "Domaines", item: siteUrl(MARKETING_PATHS.domaines) },
    { name: domain.name, item: siteUrl(domainPath(domain)) },
  ].map((crumb, i) => ({ "@type": "ListItem", position: i + 1, ...crumb })),
})

/** `null` sans produit : un `Product` sans offre est invalide. */
export const offersJsonLd = (
  products: readonly ProductView[],
): JsonLdData | null =>
  products.length === 0
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Accès NOMAQbanq",
        image: siteUrl(SITE_OG_IMAGE.url),
        description:
          "Accès à la banque de QCM et aux examens blancs pour préparer l'EACMC Partie I.",
        brand: { "@type": "Brand", name: "NOMAQbanq" },
        offers: products.map((p) => ({
          "@type": "Offer",
          name: p.name,
          description: p.description,
          price: (p.priceCAD / 100).toFixed(2),
          priceCurrency: "CAD",
          availability: "https://schema.org/InStock",
          url: siteUrl(MARKETING_PATHS.tarifs),
        })),
      }

/**
 * Article de la vitrine : l'équipe reste anonyme, l'organisation en est
 * l'auteur. `dateModified` = dernière révision des faits, pas du fichier.
 * Image du site : celle d'un segment sous un groupe de routes porte un
 * suffixe calculé par Next (`opengraph-image-<hash>`), inconnu ici.
 */
export const articleJsonLd = ({
  path,
  headline,
  description,
  datePublished,
  dateModified,
}: {
  path: string
  headline: string
  description: string
  datePublished: string
  dateModified: string
}): JsonLdData => ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline,
  description,
  inLanguage: "fr-CA",
  datePublished,
  dateModified,
  mainEntityOfPage: siteUrl(path),
  image: siteUrl(SITE_OG_IMAGE.url),
  author: ORGANIZATION,
  publisher: ORGANIZATION,
})

export const faqPageJsonLd = (
  questions: readonly { q: string; a: string }[],
): JsonLdData => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: questions.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
})
