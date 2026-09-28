import {
  BookOpen,
  ClipboardList,
  FileQuestionMark,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  User,
  Users,
} from "lucide-react"

export type NavItem = { title: string; url: string; icon: LucideIcon }
export type NavSection = { heading: string; items: NavItem[] }

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
        title: "Entraînement",
        url: "/tableau-de-bord/entrainement",
        icon: BookOpen,
      },
      {
        title: "Examens blancs",
        url: "/tableau-de-bord/examen-blanc",
        icon: ClipboardList,
      },
      {
        title: "Abonnements",
        url: "/tableau-de-bord/abonnements",
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
      { title: "Tableau de bord", url: "/admin", icon: LayoutDashboard },
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
      { title: "Profil", url: "/admin/profil", icon: User },
    ],
  },
]

/** Paramètre d'URL qui présélectionne un domaine dans l'entraînement. */
export const TRAINING_DOMAIN_PARAM = "domaine"

export const trainingDomainUrl = (domain: string) =>
  `/tableau-de-bord/entrainement?${TRAINING_DOMAIN_PARAM}=${encodeURIComponent(domain)}`

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
  { name: "Domaines", href: "/domaines" },
  { name: "Tarifs", href: "/tarifs" },
  { name: "FAQ", href: "/faq" },
]

/** Liens réservés au menu mobile : l'en-tête large les porte en boutons. */
export const HEADER_MENU_ONLY_NAV = [
  { name: "Essai gratuit", href: "/evaluation" },
  { name: "À propos", href: "/a-propos" },
]

// Liens du footer
export const FOOTER_QUICK_LINKS = [
  { name: "Accueil", href: "/" },
  { name: "Domaines", href: "/domaines" },
  { name: "Évaluation", href: "/evaluation" },
  { name: "Tarifs", href: "/tarifs" },
  { name: "FAQ", href: "/faq" },
  { name: "À propos", href: "/a-propos" },
] as const

export const FOOTER_LEGAL_LINKS = [
  {
    name: "Politique de confidentialité",
    href: "/confidentialite",
  },
  { name: "Conditions d'utilisation", href: "/conditions" },
  { name: "Cookies", href: "/cookies" },
] as const

/**
 * Claims marketing ÉDITORIAUX (non calculés). `successRate` sert de repli quand
 * le vrai taux (features/marketing/dal.ts) n'est pas publiable (volume ou
 * plancher). `rating` reste 100 % éditorial : aucun système d'avis en base.
 */
export const MARKETING_CLAIMS = {
  successRate: "85%",
  rating: "4.9/5",
} as const
