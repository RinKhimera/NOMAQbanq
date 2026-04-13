/**
 * Metadata statique pour les domaines médicaux (description, icône, slug).
 * Les compteurs de questions viennent dynamiquement de Convex via getMarketingStats.
 */
export interface DomainMetadata {
  description: string
  icon: string
  slug: string
}

export const domainMetadataMap: Record<string, DomainMetadata> = {
  "Anesthésie-Réanimation": {
    description:
      "Anesthésie générale et locorégionale, réanimation et soins critiques",
    icon: "Wind",
    slug: "anesthesie-reanimation",
  },
  Autres: {
    description: "Questions transversales et cas multidisciplinaires",
    icon: "LayoutGrid",
    slug: "autres",
  },
  Cardiologie: {
    description:
      "Pathologies cardiovasculaires, ECG, insuffisance cardiaque et arythmies",
    icon: "Heart",
    slug: "cardiologie",
  },
  Chirurgie: {
    description:
      "Chirurgie générale, urgences chirurgicales et soins périopératoires",
    icon: "Scissors",
    slug: "chirurgie",
  },
  Dermatologie: {
    description:
      "Lésions cutanées, dermatoses inflammatoires et infections de la peau",
    icon: "Fingerprint",
    slug: "dermatologie",
  },
  Endocrinologie: {
    description: "Diabète, troubles thyroïdiens, surrénaliens et métaboliques",
    icon: "Flame",
    slug: "endocrinologie",
  },
  "Gastro-entérologie": {
    description:
      "Troubles digestifs, hépatologie et pathologies inflammatoires",
    icon: "Activity",
    slug: "gastro-enterologie",
  },
  Gastroentérologie: {
    description:
      "Troubles digestifs, hépatologie et pathologies inflammatoires",
    icon: "Activity",
    slug: "gastroenterologie",
  },
  "Gynécologie obstétrique": {
    description:
      "Santé reproductive, obstétrique et pathologies gynécologiques",
    icon: "Baby",
    slug: "gynecologie-obstetrique",
  },
  "Hémato-oncologie": {
    description: "Hématologie, cancérologie et traitements oncologiques",
    icon: "Droplets",
    slug: "hemato-oncologie",
  },
  Infectiologie: {
    description:
      "Maladies infectieuses, antibiothérapie et infections nosocomiales",
    icon: "Bug",
    slug: "infectiologie",
  },
  "Médecine interne": {
    description:
      "Approche globale du patient, diagnostic différentiel et cas complexes",
    icon: "Stethoscope",
    slug: "medecine-interne",
  },
  Néphrologie: {
    description: "Insuffisance rénale, troubles électrolytiques et dialyse",
    icon: "Bean",
    slug: "nephrologie",
  },
  Neurologie: {
    description:
      "Pathologies neurologiques, AVC, épilepsie et troubles cognitifs",
    icon: "Brain",
    slug: "neurologie",
  },
  Ophtalmologie: {
    description: "Pathologies oculaires, urgences et troubles visuels",
    icon: "Eye",
    slug: "ophtalmologie",
  },
  ORL: {
    description:
      "Oto-rhino-laryngologie, troubles auditifs et pathologies cervicales",
    icon: "Ear",
    slug: "orl",
  },
  Orthopédie: {
    description: "Fractures, traumatologie, pathologies musculo-squelettiques",
    icon: "Bone",
    slug: "orthopedie",
  },
  Pédiatrie: {
    description:
      "Médecine de l'enfant, développement et pathologies pédiatriques",
    icon: "Users",
    slug: "pediatrie",
  },
  Pneumologie: {
    description:
      "Maladies respiratoires, asthme, BPCO et infections pulmonaires",
    icon: "Wind",
    slug: "pneumologie",
  },
  Psychiatrie: {
    description:
      "Troubles psychiatriques, psychopharmacologie et urgences psychiatriques",
    icon: "BrainCircuit",
    slug: "psychiatrie",
  },
  Rhumatologie: {
    description:
      "Maladies articulaires, auto-immunes et inflammatoires chroniques",
    icon: "Hand",
    slug: "rhumatologie",
  },
  "Santé publique et médecine préventive": {
    description:
      "Épidémiologie, prévention, biostatistiques et santé des populations",
    icon: "Shield",
    slug: "sante-publique",
  },
  Urologie: {
    description: "Pathologies urinaires, prostate et chirurgie urologique",
    icon: "Droplet",
    slug: "urologie",
  },
}

/** Fallback pour domaines sans metadata explicite */
const defaultMetadata: DomainMetadata = {
  description: "Questions médicales spécialisées",
  icon: "BookOpen",
  slug: "domaine",
}

/** Récupère la metadata d'un domaine avec fallback */
export function getDomainMetadata(domain: string): DomainMetadata {
  return domainMetadataMap[domain] ?? defaultMetadata
}
