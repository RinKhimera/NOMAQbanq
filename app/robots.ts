import { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/tableau-de-bord/",
          "/connexion",
          "/inscription",
          "/mot-de-passe-oublie",
          "/reinitialiser-mot-de-passe",
          "/desabonnement",
          // Le quiz tire ses questions en base au montage : un robot qui suit
          // le lien depuis `/evaluation` réveillerait Neon à chaque passage.
          "/evaluation/quiz",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
