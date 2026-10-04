/**
 * Les 22 domaines de la banque tels que la vitrine les présente : groupes et
 * slugs des pages `/domaines/[slug]`. Leurs objectifs du CMC viennent du
 * référentiel, à travers le cache (`getCachedDomainObjectives`). Aucun nombre
 * de questions par domaine ici, il est réservé à l'admin.
 */
import type { MedicalDomain } from "@/constants"

export type DomainGroupId = "med" | "chir" | "me" | "sp"

export type DomainGroup = { id: DomainGroupId; label: string }

export type PublicDomain = {
  name: MedicalDomain
  slug: string
  description: string
  group: DomainGroup
}

export const DOMAIN_GROUPS: readonly DomainGroup[] = [
  { id: "med", label: "Médecine" },
  { id: "chir", label: "Chirurgie et spécialités" },
  { id: "me", label: "Mère et enfant" },
  { id: "sp", label: "Santé mentale et populationnelle" },
]

const group = (id: DomainGroupId) =>
  DOMAIN_GROUPS.find((g) => g.id === id) as DomainGroup

/** Dans l'ordre d'affichage : groupe après groupe, comme sur `/domaines`. */
export const DOMAINS: readonly PublicDomain[] = [
  {
    name: "Cardiologie",
    slug: "cardiologie",
    description:
      "Pathologies cardiovasculaires, ECG, insuffisance cardiaque et arythmies",
    group: group("med"),
  },
  {
    name: "Dermatologie",
    slug: "dermatologie",
    description:
      "Lésions cutanées, dermatoses inflammatoires et infections de la peau",
    group: group("med"),
  },
  {
    name: "Endocrinologie",
    slug: "endocrinologie",
    description: "Diabète, troubles thyroïdiens, surrénaliens et métaboliques",
    group: group("med"),
  },
  {
    name: "Gastro-entérologie",
    slug: "gastro-enterologie",
    description:
      "Troubles digestifs, hépatologie et pathologies inflammatoires",
    group: group("med"),
  },
  {
    name: "Hémato-oncologie",
    slug: "hemato-oncologie",
    description: "Hématologie, cancérologie et traitements oncologiques",
    group: group("med"),
  },
  {
    name: "Infectiologie",
    slug: "infectiologie",
    description:
      "Maladies infectieuses, antibiothérapie et infections nosocomiales",
    group: group("med"),
  },
  {
    name: "Médecine interne",
    slug: "medecine-interne",
    description:
      "Approche globale du patient, diagnostic différentiel et cas complexes",
    group: group("med"),
  },
  {
    name: "Néphrologie",
    slug: "nephrologie",
    description: "Insuffisance rénale, troubles électrolytiques et dialyse",
    group: group("med"),
  },
  {
    name: "Neurologie",
    slug: "neurologie",
    description:
      "Pathologies neurologiques, AVC, épilepsie et troubles cognitifs",
    group: group("med"),
  },
  {
    name: "Pneumologie",
    slug: "pneumologie",
    description:
      "Maladies respiratoires, asthme, BPCO et infections pulmonaires",
    group: group("med"),
  },
  {
    name: "Rhumatologie",
    slug: "rhumatologie",
    description:
      "Maladies articulaires, auto-immunes et inflammatoires chroniques",
    group: group("med"),
  },
  {
    name: "Anesthésie-Réanimation",
    slug: "anesthesie-reanimation",
    description:
      "Anesthésie générale et locorégionale, réanimation et soins critiques",
    group: group("chir"),
  },
  {
    name: "Chirurgie",
    slug: "chirurgie",
    description:
      "Chirurgie générale, urgences chirurgicales et soins périopératoires",
    group: group("chir"),
  },
  {
    name: "Ophtalmologie",
    slug: "ophtalmologie",
    description: "Pathologies oculaires, urgences et troubles visuels",
    group: group("chir"),
  },
  {
    name: "ORL",
    slug: "orl",
    description:
      "Oto-rhino-laryngologie, troubles auditifs et pathologies cervicales",
    group: group("chir"),
  },
  {
    name: "Orthopédie",
    slug: "orthopedie",
    description: "Fractures, traumatologie, pathologies musculo-squelettiques",
    group: group("chir"),
  },
  {
    name: "Urologie",
    slug: "urologie",
    description: "Pathologies urinaires, prostate et chirurgie urologique",
    group: group("chir"),
  },
  {
    name: "Gynécologie obstétrique",
    slug: "gynecologie-obstetrique",
    description:
      "Santé reproductive, obstétrique et pathologies gynécologiques",
    group: group("me"),
  },
  {
    name: "Pédiatrie",
    slug: "pediatrie",
    description:
      "Médecine de l'enfant, développement et pathologies pédiatriques",
    group: group("me"),
  },
  {
    name: "Psychiatrie",
    slug: "psychiatrie",
    description:
      "Troubles psychiatriques, psychopharmacologie et urgences psychiatriques",
    group: group("sp"),
  },
  {
    name: "Santé publique et médecine préventive",
    slug: "sante-publique",
    description:
      "Épidémiologie, prévention, biostatistiques et santé des populations",
    group: group("sp"),
  },
  {
    name: "Autres",
    slug: "autres",
    description: "Questions transversales et cas multidisciplinaires",
    group: group("sp"),
  },
]

export const domainBySlug = (slug: string): PublicDomain | undefined =>
  DOMAINS.find((d) => d.slug === slug)
