import { MetadataRoute } from "next"
import { MARKETING_PATHS } from "@/constants"
import { INDEXED_DOMAINS, domainPath } from "@/constants/domains"
import { siteUrl } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
  // Date de dernière mise à jour majeure du contenu
  const lastContentUpdate = new Date("2026-09-28")
  const legalPagesUpdate = new Date("2026-01-15")
  const termsUpdate = new Date("2026-09-28")

  return [
    // Pages marketing principales
    {
      url: siteUrl(MARKETING_PATHS.home),
      lastModified: lastContentUpdate,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: siteUrl(MARKETING_PATHS.domaines),
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...INDEXED_DOMAINS.map((d) => ({
      url: siteUrl(domainPath(d)),
      lastModified: lastContentUpdate,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: siteUrl(MARKETING_PATHS.fonctionnement),
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: siteUrl(MARKETING_PATHS.tarifs),
      lastModified: lastContentUpdate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: siteUrl(MARKETING_PATHS.evaluation),
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: siteUrl(MARKETING_PATHS.faq),
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: siteUrl(MARKETING_PATHS.aPropos),
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // Pages légales
    {
      url: siteUrl(MARKETING_PATHS.conditions),
      lastModified: termsUpdate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: siteUrl(MARKETING_PATHS.confidentialite),
      lastModified: legalPagesUpdate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: siteUrl(MARKETING_PATHS.cookies),
      lastModified: legalPagesUpdate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
