import { faqCategories } from "@/app/(marketing)/faq/_data/faq-data"
import { DOMAINS, INDEXED_DOMAINS } from "@/constants/domains"
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/seo"

// Rendu au build : la vitrine ne lit pas la base au rendu.
export const dynamic = "force-static"

const KEY_PAGES = [
  {
    path: "/domaines",
    name: "Domaines médicaux",
    about: `les ${DOMAINS.length} domaines de la banque de questions, rattachés aux objectifs du CMC`,
  },
  {
    path: "/fonctionnement",
    name: "Fonctionnement",
    about:
      "composer une série, apprendre en mode tuteur, se mettre en conditions d'examen, suivre sa progression",
  },
  {
    path: "/tarifs",
    name: "Tarifs",
    about:
      "accès Examens, accès Entraînement et Pack Premium, en dollars canadiens",
  },
  {
    path: "/evaluation",
    name: "Évaluation gratuite",
    about: "une série de questions chronométrée, sans inscription",
  },
  { path: "/faq", name: "FAQ", about: "questions fréquentes" },
  {
    path: "/a-propos",
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
    ...KEY_PAGES.map((p) => `- [${p.name}](${SITE_URL}${p.path}) : ${p.about}`),
    "",
    "## Domaines médicaux",
    "",
    ...INDEXED_DOMAINS.map(
      (d) => `- [${d.name}](${SITE_URL}/domaines/${d.slug}) : ${d.description}`,
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
