import {
  BookOpen,
  ChartNoAxesColumn,
  ClipboardList,
  FileQuestionMark,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  User,
  Users,
} from "lucide-react"
import type { RevisionCriterion } from "@/features/training/schemas"
import { ADMIN_HREF, ADMIN_PROGRESSION_HREF } from "@/lib/admin-links"

export type NavItem = { title: string; url: string; icon: LucideIcon }
export type NavSection = { heading: string; items: NavItem[] }

/** Page « Progression » de l'étudiant. */
export const PROGRESSION_HREF = "/tableau-de-bord/progression"

/** Page « Entraînement » : formulaire d'une série et historique des séries. */
export const TRAINING_HREF = "/tableau-de-bord/entrainement"

/** Page « Abonnements » : accès en cours et historique des achats. */
export const ACCESS_HREF = "/tableau-de-bord/abonnements"

/** Grille tarifaire de la vitrine. */
export const PRICING_HREF = "/tarifs"

/** Pages publiques de la vitrine : navigation, métadonnées, sitemap, `llms.txt`. */
export const MARKETING_PATHS = {
  home: "/",
  fonctionnement: "/fonctionnement",
  eacmc: "/eacmc-partie-1",
  domaines: "/domaines",
  evaluation: "/evaluation",
  tarifs: PRICING_HREF,
  faq: "/faq",
  aPropos: "/a-propos",
  confidentialite: "/confidentialite",
  conditions: "/conditions",
  cookies: "/cookies",
} as const

export const studentNavSections: NavSection[] = [
  {
    heading: "Espace étudiant",
    items: [
      {
        title: "Tableau de bord",
        url: "/tableau-de-bord",
        icon: LayoutDashboard,
      },
      {
        title: "Progression",
        url: PROGRESSION_HREF,
        icon: ChartNoAxesColumn,
      },
      {
        title: "Entraînement",
        url: TRAINING_HREF,
        icon: BookOpen,
      },
      {
        title: "Examens blancs",
        url: "/tableau-de-bord/examen-blanc",
        icon: ClipboardList,
      },
      {
        title: "Abonnements",
        url: ACCESS_HREF,
        icon: Receipt,
      },
      { title: "Profil", url: "/tableau-de-bord/profil", icon: User },
    ],
  },
]

export const adminNavSections: NavSection[] = [
  {
    heading: "Pilotage",
    items: [
      { title: "Tableau de bord", url: ADMIN_HREF, icon: LayoutDashboard },
      { title: "Transactions", url: "/admin/transactions", icon: Receipt },
    ],
  },
  {
    heading: "Contenu",
    items: [
      { title: "Questions", url: "/admin/questions", icon: FileQuestionMark },
      { title: "Examens blancs", url: "/admin/examens", icon: ClipboardList },
    ],
  },
  {
    heading: "Comptes",
    items: [
      { title: "Utilisateurs", url: "/admin/utilisateurs", icon: Users },
      {
        title: "Progression",
        url: ADMIN_PROGRESSION_HREF,
        icon: ChartNoAxesColumn,
      },
      { title: "Profil", url: "/admin/profil", icon: User },
    ],
  },
]

/** Référentiel des objectifs du CMC (fusion des variantes, valeurs invalides). */
export const OBJECTIVES_HREF = "/admin/questions/objectifs"

/** Paramètre d'URL qui présélectionne un domaine dans l'entraînement. */
export const TRAINING_DOMAIN_PARAM = "domaine"

export const trainingDomainUrl = (domain: string) =>
  `${TRAINING_HREF}?${TRAINING_DOMAIN_PARAM}=${encodeURIComponent(domain)}`

/** Paramètre d'URL qui précoche un critère de révision ciblée dans l'entraînement. */
export const TRAINING_REVISION_PARAM = "revision"

/** Formulaire Entraînement pré-rempli : domaine et critère de révision. */
export const trainingRevisionUrl = (
  domain: string,
  criterion: RevisionCriterion,
) => `${trainingDomainUrl(domain)}&${TRAINING_REVISION_PARAM}=${criterion}`

// Domaines médicaux prédéfinis
export const MEDICAL_DOMAINS = [
  "Anesthésie-Réanimation",
  "Autres",
  "Cardiologie",
  "Chirurgie",
  "Dermatologie",
  "Endocrinologie",
  "Gastro-entérologie",
  "Gynécologie obstétrique",
  "Hémato-oncologie",
  "Infectiologie",
  "Médecine interne",
  "Néphrologie",
  "Neurologie",
  "Ophtalmologie",
  "ORL",
  "Orthopédie",
  "Pédiatrie",
  "Pneumologie",
  "Psychiatrie",
  "Rhumatologie",
  "Santé publique et médecine préventive",
  "Urologie",
] as const

// Type dérivé des domaines médicaux
export type MedicalDomain = (typeof MEDICAL_DOMAINS)[number]

// Fonction helper pour vérifier si une string est un domaine médical valide
export const isMedicalDomain = (domain: string): domain is MedicalDomain => {
  return MEDICAL_DOMAINS.includes(domain as MedicalDomain)
}

// Liens de l'en-tête de la vitrine
export const HEADER_NAV = [
  { name: "Comment ça marche", href: MARKETING_PATHS.fonctionnement },
  { name: "Domaines", href: MARKETING_PATHS.domaines },
  { name: "Tarifs", href: MARKETING_PATHS.tarifs },
  { name: "FAQ", href: MARKETING_PATHS.faq },
]

/** Liens réservés au menu mobile : l'en-tête large les porte en boutons. */
export const HEADER_MENU_ONLY_NAV = [
  { name: "Essai gratuit", href: MARKETING_PATHS.evaluation },
  { name: "À propos", href: MARKETING_PATHS.aPropos },
]

// Liens du footer
export const FOOTER_QUICK_LINKS = [
  { name: "Accueil", href: MARKETING_PATHS.home },
  { name: "Comment ça marche", href: MARKETING_PATHS.fonctionnement },
  { name: "Guide EACMC", href: MARKETING_PATHS.eacmc },
  { name: "Domaines", href: MARKETING_PATHS.domaines },
  { name: "Évaluation", href: MARKETING_PATHS.evaluation },
  { name: "Tarifs", href: MARKETING_PATHS.tarifs },
  { name: "FAQ", href: MARKETING_PATHS.faq },
  { name: "À propos", href: MARKETING_PATHS.aPropos },
] as const

export const FOOTER_LEGAL_LINKS = [
  {
    name: "Politique de confidentialité",
    href: MARKETING_PATHS.confidentialite,
  },
  { name: "Conditions d'utilisation", href: MARKETING_PATHS.conditions },
  { name: "Cookies", href: MARKETING_PATHS.cookies },
] as const
