import { MARKETING_PATHS } from "@/constants"

/**
 * Dernière relecture des faits du guide contre mcc.ca (`yyyy-MM-dd`). Ne
 * change qu'à une relecture factuelle, pas à une correction de forme : elle
 * est affichée et reprise par le sitemap et le JSON-LD. La relecture couvre
 * aussi les réponses de la catégorie « eacmc » de la FAQ, qui en reprennent
 * des chiffres.
 */
export const GUIDE_REVIEWED_ON = "2026-10-16"

export const GUIDE_PUBLISHED_ON = "2026-10-15"

export const GUIDE_TITLE =
  "EACMC (anciennement Partie I) : guide de préparation"

export const GUIDE_DESCRIPTION =
  "Guide en français de l'EACMC, l'ancienne EACMC partie 1 : format de l'examen, notation, inscription, parcours des diplômés à l'étranger et méthode de préparation, avec les sources du CMC."

/** Sections du guide, dans l'ordre : ancres du sommaire et de la FAQ. */
export const GUIDE_SECTIONS = [
  { id: "definition", title: "Qu'est-ce que l'EACMC ?" },
  { id: "deroulement", title: "Comment se déroule l'examen ?" },
  { id: "notation", title: "Comment l'examen est-il noté ?" },
  {
    id: "inscription",
    title: "Comment s'inscrire et quand passer l'examen ?",
  },
  {
    id: "diplomes-etranger",
    title: "Je suis diplômé à l'étranger : où se situe l'EACMC ?",
  },
  {
    id: "preparation",
    title: "Comment se préparer à l'EACMC en français ?",
  },
] as const

export type GuideSectionId = (typeof GUIDE_SECTIONS)[number]["id"]

export const guideAnchor = (id: GuideSectionId) =>
  `${MARKETING_PATHS.eacmc}#${id}`

/** Pages du Conseil médical du Canada (et des organismes cités) qui sourcent le guide. */
export const SOURCES = {
  eacmc: "https://mcc.ca/fr/examens-et-evaluations/eacmc/",
  qcm: "https://mcc.ca/fr/examens-et-evaluations/eacmc/le-jour-de-lexamen/questions-a-choix-multiple/",
  jourExamen:
    "https://mcc.ca/fr/examens-et-evaluations/eacmc/le-jour-de-lexamen/",
  resultats: "https://mcc.ca/fr/examens-et-evaluations/eacmc/resultats/",
  admissibilite:
    "https://mcc.ca/fr/examens-et-evaluations/eacmc/admissibilite-et-demande/",
  planification:
    "https://mcc.ca/fr/examens-et-evaluations/eacmc/planification/",
  prometric:
    "https://mcc.ca/fr/examens-et-evaluations/reserver-une-session-aupres-de-prometric/",
  frais: "https://mcc.ca/fr/frais-relies-aux-examens-et-aux-services/",
  verification:
    "https://mcc.ca/fr/titres-de-competences-et-services/services/verification-des-titres-de-competence/",
  lcmc: "https://mcc.ca/fr/titres-de-competences-et-services/parcours-vers-lobtention-du-permis-dexercice/lcmc/",
  carms:
    "https://mcc.ca/fr/titres-de-competences-et-services/parcours-vers-lobtention-du-permis-dexercice/carms-et-les-examens-du-cmc/",
  objectifs: "https://mcc.ca/fr/objectifs/",
  ressources:
    "https://mcc.ca/fr/examens-et-evaluations/ressources-pour-aider-a-la-preparation-dun-examen/",
  ressourcesGratuites: "https://mcc.ca/fr/ressources-gratuites/",
  inscriptionmed: "https://portail.inscriptionmed.ca/Account/InitialLogin",
  carmsSite: "https://www.carms.ca/fr/",
  cmq: "https://www.cmq.org/fr/acceder-a-la-profession/examens",
} as const
