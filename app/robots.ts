import { MetadataRoute } from "next"

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
    sitemap: "https://nomaqbanq.ca/sitemap.xml",
  }
}
