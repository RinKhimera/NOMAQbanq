import type { PublicDomain } from "@/constants/domains"
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

/** Générée par `app/opengraph-image.tsx`. */
export const SITE_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "NOMAQbanq, préparation à l'EACMC Partie I",
}

export type JsonLdData = {
  "@context": "https://schema.org"
  "@type": string
  [key: string]: unknown
}

export const organizationJsonLd = (): JsonLdData => ({
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "NOMAQbanq",
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
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
    { name: "Domaines", item: `${SITE_URL}/domaines` },
    { name: domain.name, item: `${SITE_URL}/domaines/${domain.slug}` },
  ].map((crumb, i) => ({ "@type": "ListItem", position: i + 1, ...crumb })),
})

/** À ne rendre qu'avec au moins un produit : une offre vide est invalide. */
export const offersJsonLd = (products: readonly ProductView[]): JsonLdData => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Accès NOMAQbanq",
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
    url: `${SITE_URL}/tarifs`,
  })),
})
