/**
 * Les 22 domaines de la banque tels que la vitrine les présente : groupes,
 * slugs des pages `/domaines/[slug]` et principaux objectifs du CMC.
 *
 * Liste figée, relevée sur la base (texte libre, ~695 variantes dédoublonnées
 * à la main) : la vitrine ne lit jamais Neon pour l'afficher. Aucun nombre
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
  objectives: readonly string[]
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
    objectives: [
      "Arrêt cardiaque",
      "Bruits cardiaques anormaux, souffles cardiaques",
      "Douleur thoracique",
      "Dyslipidémie",
      "Hypertension artérielle",
      "Hypotension, état de choc",
      "Palpitations",
      "Syncope et présyncope",
      "Prévention des thromboses veineuses",
    ],
  },
  {
    name: "Dermatologie",
    slug: "dermatologie",
    description:
      "Lésions cutanées, dermatoses inflammatoires et infections de la peau",
    group: group("med"),
    objectives: [
      "Affections cutanées et tégumentaires",
      "Lésions cutanées",
      "Lésions cutanées suspectes de malignité",
      "Prurit",
      "Réactions allergiques et atopie",
      "Urticaires, angio-œdème",
    ],
  },
  {
    name: "Endocrinologie",
    slug: "endocrinologie",
    description: "Diabète, troubles thyroïdiens, surrénaliens et métaboliques",
    group: group("med"),
    objectives: [
      "Anomalies de la glycémie",
      "Diabète",
      "Dyslipidémie",
      "Masse cervicale, goitre, maladie thyroïdienne",
      "Hypothyroïdie",
      "Polyurie et/ou polydipsie",
      "Prise de poids et obésité",
      "Troubles du métabolisme du calcium",
    ],
  },
  {
    name: "Gastro-entérologie",
    slug: "gastro-enterologie",
    description:
      "Troubles digestifs, hépatologie et pathologies inflammatoires",
    group: group("med"),
    objectives: [
      "Diarrhée aiguë",
      "Diarrhée chronique",
      "Douleur abdominale chronique",
      "Dysphagie",
      "Hémorragie digestive haute",
      "Hémorragie digestive basse",
      "Ictère",
      "Tests de la fonction hépatique anormaux",
      "Constipation chez l'adulte",
    ],
  },
  {
    name: "Hémato-oncologie",
    slug: "hemato-oncologie",
    description: "Hématologie, cancérologie et traitements oncologiques",
    group: group("med"),
    objectives: [
      "Anémie",
      "Lymphadénopathie",
      "Saignements, ecchymoses",
      "Taux d'hémoglobine sérique élevé",
      "Patient en phase terminale",
      "Perte de poids / troubles alimentaires / anorexie",
    ],
  },
  {
    name: "Infectiologie",
    slug: "infectiologie",
    description:
      "Maladies infectieuses, antibiothérapie et infections nosocomiales",
    group: group("med"),
    objectives: [
      "Fièvre et hyperthermie",
      "Fièvre chez le patient immunodéprimé / fièvres récurrentes",
      "Dysurie, pollakiurie, mictions impérieuses, pyurie",
      "Mal de gorge ou rhinorrhée",
      "Convulsions, épilepsie",
      "Lymphadénopathie",
    ],
  },
  {
    name: "Médecine interne",
    slug: "medecine-interne",
    description:
      "Approche globale du patient, diagnostic différentiel et cas complexes",
    group: group("med"),
    objectives: [
      "Anémie",
      "Cyanose et hypoxie",
      "Démence",
      "Fatigue",
      "Fragilité chez les personnes âgées",
      "Hypernatrémie",
      "Hypokaliémie",
      "Troubles de l'équilibre acido-basique",
      "Prévention des thromboses veineuses",
    ],
  },
  {
    name: "Néphrologie",
    slug: "nephrologie",
    description: "Insuffisance rénale, troubles électrolytiques et dialyse",
    group: group("med"),
    objectives: [
      "Hyperkaliémie",
      "Hyponatrémie",
      "Hypokaliémie",
      "Insuffisance rénale aiguë (anurie ou oligurie)",
      "Insuffisance rénale chronique",
      "Protéinurie",
      "Sang dans les urines, hématurie",
      "Troubles de l'équilibre acido-basique",
    ],
  },
  {
    name: "Neurologie",
    slug: "neurologie",
    description:
      "Pathologies neurologiques, AVC, épilepsie et troubles cognitifs",
    group: group("med"),
    objectives: [
      "Accident vasculaire cérébral et ischémie cérébrale transitoire",
      "Céphalées",
      "Coma",
      "Convulsions, épilepsie",
      "Étourdissements, vertiges",
      "Faiblesse non attribuable à un accident vasculaire cérébral",
      "Troubles neurocognitifs majeurs / légers (démence)",
      "Troubles moteurs, tics",
    ],
  },
  {
    name: "Pneumologie",
    slug: "pneumologie",
    description:
      "Maladies respiratoires, asthme, BPCO et infections pulmonaires",
    group: group("med"),
    objectives: [
      "Cyanose et hypoxie",
      "Dyspnée",
      "Épanchement pleural",
      "Masse médiastinale",
      "Sang dans les expectorations (hémoptysie)",
      "Toux",
      "Problèmes de santé liés au travail",
    ],
  },
  {
    name: "Rhumatologie",
    slug: "rhumatologie",
    description:
      "Maladies articulaires, auto-immunes et inflammatoires chroniques",
    group: group("med"),
    objectives: [
      "Douleurs dorsales et symptômes connexes",
      "Douleur lombaire",
      "Oligoarthralgie",
      "Polyarthralgie",
      "Troubles caractérisés par des douleurs généralisées",
      "Troubles du métabolisme du calcium",
    ],
  },
  {
    name: "Anesthésie-Réanimation",
    slug: "anesthesie-reanimation",
    description:
      "Anesthésie générale et locorégionale, réanimation et soins critiques",
    group: group("chir"),
    objectives: [
      "Dyspnée",
      "Hyperkaliémie",
      "Hyponatrémie",
      "Hypotension, état de choc",
      "Hypothermie et lésions causées par le froid",
      "Intoxication",
      "Syncope et présyncope",
    ],
  },
  {
    name: "Chirurgie",
    slug: "chirurgie",
    description:
      "Chirurgie générale, urgences chirurgicales et soins périopératoires",
    group: group("chir"),
    objectives: [
      "Douleur abdominale aiguë",
      "Douleur ano-rectale",
      "Hernie de la paroi abdominale et hernie inguinale",
      "Brûlures",
      "Blessures abdominales",
      "Blessures au thorax",
      "Évaluation médicale préopératoire",
      "Masse abdominale et pelvienne",
      "Traumatismes crâniens, mort cérébrale, don d'organes",
    ],
  },
  {
    name: "Ophtalmologie",
    slug: "ophtalmologie",
    description: "Pathologies oculaires, urgences et troubles visuels",
    group: group("chir"),
    objectives: [
      "Perturbation / perte aiguë de la vision",
      "Perturbation / perte chronique de la vision",
      "Rougeur oculaire",
      "Blessure au visage",
    ],
  },
  {
    name: "ORL",
    slug: "orl",
    description:
      "Oto-rhino-laryngologie, troubles auditifs et pathologies cervicales",
    group: group("chir"),
    objectives: [
      "Acouphènes",
      "Douleurs de l'oreille",
      "Étourdissements, vertiges",
      "Mal de gorge ou rhinorrhée",
      "Masse cervicale, goitre, maladie thyroïdienne",
      "Perte auditive et surdité",
    ],
  },
  {
    name: "Orthopédie",
    slug: "orthopedie",
    description: "Fractures, traumatologie, pathologies musculo-squelettiques",
    group: group("chir"),
    objectives: [
      "Blessures osseuses ou articulaires",
      "Douleur musculosquelettique non articulaire",
      "Lésions nerveuses",
      "Oligoarthralgie",
      "Traumatismes de l'appareil locomoteur",
    ],
  },
  {
    name: "Urologie",
    slug: "urologie",
    description: "Pathologies urinaires, prostate et chirurgie urologique",
    group: group("chir"),
    objectives: [
      "Douleur scrotale",
      "Dysfonctionnements et troubles sexuels",
      "Incontinence urinaire chez l'adulte",
      "Infertilité",
      "Sang dans les urines, hématurie",
      "Symptômes du bas appareil urinaire",
    ],
  },
  {
    name: "Gynécologie obstétrique",
    slug: "gynecologie-obstetrique",
    description:
      "Santé reproductive, obstétrique et pathologies gynécologiques",
    group: group("me"),
    objectives: [
      "Aménorrhée, oligoménorrhée",
      "Contraception",
      "Infertilité",
      "Ménopause",
      "Saignements vaginaux excessifs, irréguliers, anormaux",
      "Soins prénataux",
      "Soins intrapartum et post-partum",
      "Troubles hypertensifs de la grossesse",
      "Travail prématuré",
    ],
  },
  {
    name: "Pédiatrie",
    slug: "pediatrie",
    description:
      "Médecine de l'enfant, développement et pathologies pédiatriques",
    group: group("me"),
    objectives: [
      "Détresse respiratoire chez l'enfant",
      "Diarrhée chez l'enfant",
      "Examen du nouveau-né",
      "Ictère du nouveau-né",
      "Retard de développement",
      "Retard staturo-pondéral",
      "Vaccination",
      "Mauvais traitements envers un enfant",
      "La santé de l'enfant et de l'adolescent",
    ],
  },
  {
    name: "Psychiatrie",
    slug: "psychiatrie",
    description:
      "Troubles psychiatriques, psychopharmacologie et urgences psychiatriques",
    group: group("sp"),
    objectives: [
      "Anxiété",
      "Comportement suicidaire",
      "Humeur dépressive",
      "Manie / hypomanie",
      "Psychose",
      "Sevrage à une substance",
      "Troubles de la personnalité",
      "Troubles liés à une substance et troubles de dépendance",
    ],
  },
  {
    name: "Santé publique et médecine préventive",
    slug: "sante-publique",
    description:
      "Épidémiologie, prévention, biostatistiques et santé des populations",
    group: group("sp"),
    objectives: [
      "Concepts de la santé et ses facteurs déterminants",
      "Confidentialité",
      "Consentement",
      "Évaluation et mesure de l'état de santé à l'échelle de la population",
      "Obligation de dire la vérité",
      "Prise en charge d'une épidémie",
      "Santé des Autochtones",
      "Vaccination",
    ],
  },
  {
    name: "Autres",
    slug: "autres",
    description: "Questions transversales et cas multidisciplinaires",
    group: group("sp"),
    objectives: [
      "Affections buccales",
      "Chutes",
      "Informatique clinique",
      "Inquiétudes d'ordre génétique",
      "Patient en phase terminale",
      "Pratiques en matière de prescription",
      "Urticaires, angio-œdème",
    ],
  },
]

export const domainBySlug = (slug: string): PublicDomain | undefined =>
  DOMAINS.find((d) => d.slug === slug)
