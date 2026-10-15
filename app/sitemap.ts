import { MetadataRoute } from "next"
import { INDEXED_DOMAINS } from "@/constants/domains"
import { SITE_URL } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
  // Date de dernière mise à jour majeure du contenu
  const lastContentUpdate = new Date("2026-09-28")
  const legalPagesUpdate = new Date("2026-01-15")
  const termsUpdate = new Date("2026-09-28")

  return [
    // Pages marketing principales
    {
      url: SITE_URL,
      lastModified: lastContentUpdate,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/domaines`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...INDEXED_DOMAINS.map((d) => ({
      url: `${SITE_URL}/domaines/${d.slug}`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${SITE_URL}/fonctionnement`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/tarifs`,
      lastModified: lastContentUpdate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/evaluation`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/a-propos`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // Pages légales
    {
      url: `${SITE_URL}/conditions`,
      lastModified: termsUpdate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/confidentialite`,
      lastModified: legalPagesUpdate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/cookies`,
      lastModified: legalPagesUpdate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
