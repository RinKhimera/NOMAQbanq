import { faqCategories } from "@/app/(marketing)/faq/_data/faq-data"
import { MARKETING_PATHS } from "@/constants"
import { DOMAINS, INDEXED_DOMAINS, domainPath } from "@/constants/domains"
import { SITE_DESCRIPTION, siteUrl } from "@/lib/seo"

// Rendu au build : la vitrine ne lit pas la base au rendu.
export const dynamic = "force-static"

const KEY_PAGES = [
  {
    path: MARKETING_PATHS.eacmc,
    name: "Guide de l'EACMC (anciennement EACMC Partie I)",
    about:
      "format de l'examen, notation, inscription, parcours des diplômés à l'étranger et méthode de préparation, sourcés au Conseil médical du Canada",
  },
  {
    path: MARKETING_PATHS.domaines,
    name: "Domaines médicaux",
    about: `les ${DOMAINS.length} domaines de la banque de questions, rattachés aux objectifs du CMC ; ${INDEXED_DOMAINS.length} ont leur page, listée ci-dessous, les questions transversales n'en ont pas`,
  },
  {
    path: MARKETING_PATHS.fonctionnement,
    name: "Comment ça marche",
    about:
      "composer une série, apprendre en mode tuteur, se mettre en conditions d'examen, suivre sa progression",
  },
  {
    path: MARKETING_PATHS.tarifs,
    name: "Tarifs",
    about:
      "accès Examens, accès Entraînement et Pack Premium, en dollars canadiens",
  },
  {
    path: MARKETING_PATHS.evaluation,
    name: "Évaluation gratuite",
    about: "une série de questions chronométrée, sans inscription",
  },
  { path: MARKETING_PATHS.faq, name: "FAQ", about: "questions fréquentes" },
  {
    path: MARKETING_PATHS.aPropos,
    name: "À propos",
    about: "l'histoire et la mission de NOMAQbanq",
  },
]

const llmsTxt = () =>
  [
    "# NOMAQbanq",
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "NOMAQbanq s'adresse aux candidats francophones à l'EACMC Partie I (Examen d'aptitude du Conseil médical du Canada), notamment aux diplômés en médecine à l'étranger. Questions, explications et interface en français. Basée à Gatineau (Québec).",
    "",
    "## Pages clés",
    "",
    ...KEY_PAGES.map((p) => `- [${p.name}](${siteUrl(p.path)}) : ${p.about}`),
    "",
    "## Domaines médicaux",
    "",
    ...INDEXED_DOMAINS.map(
      (d) => `- [${d.name}](${siteUrl(domainPath(d))}) : ${d.description}`,
    ),
    "",
    "## FAQ",
    ...faqCategories.flatMap((c) => [
      "",
      `### ${c.title}`,
      ...c.questions.flatMap((q) => ["", `**${q.q}**`, q.a]),
    ]),
    "",
  ].join("\n")

export function GET() {
  return new Response(llmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
