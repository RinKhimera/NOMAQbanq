import { MetadataRoute } from "next"
import { DOMAINS } from "@/constants/domains"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://nomaqbanq.ca"

  // Date de dernière mise à jour majeure du contenu
  const lastContentUpdate = new Date("2026-09-28")
  const legalPagesUpdate = new Date("2026-01-15")

  return [
    // Pages marketing principales
    {
      url: baseUrl,
      lastModified: lastContentUpdate,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/domaines`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...DOMAINS.map((d) => ({
      url: `${baseUrl}/domaines/${d.slug}`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${baseUrl}/fonctionnement`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tarifs`,
      lastModified: lastContentUpdate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/evaluation`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/a-propos`,
      lastModified: lastContentUpdate,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // Pages légales
    {
      url: `${baseUrl}/conditions`,
      lastModified: legalPagesUpdate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/confidentialite`,
      lastModified: legalPagesUpdate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: legalPagesUpdate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
