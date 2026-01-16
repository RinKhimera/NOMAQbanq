import {
  IconChartBar,
  IconDashboard,
  IconListDetails,
  IconReceipt,
  IconUsers,
} from "@tabler/icons-react"
import { Blocks, CircleUserRound, CreditCard, Settings, ShieldCheck, User } from "lucide-react"

export const adminNavigation = {
  navMain: [
    {
      title: "Tableau de bord",
      url: "/admin",
      icon: IconDashboard,
    },
    {
      title: "Questions",
      url: "/admin/questions",
      icon: IconListDetails,
    },
    {
      title: "Banque d'apprentissage",
      url: "/admin/learning-bank",
      icon: Blocks,
    },
    {
      title: "Examens",
      url: "/admin/exams",
      icon: IconChartBar,
    },
    {
      title: "Utilisateurs",
      url: "/admin/users",
      icon: IconUsers,
    },
    {
      title: "Transactions",
      url: "/admin/transactions",
      icon: IconReceipt,
    },
  ],
  navSecondary: [
    {
      title: "Profil",
      url: "/admin/profil",
      icon: User,
    },
    {
      title: "Compte",
      url: "/admin/account",
      icon: CircleUserRound,
    },
    {
      title: "Sécurité",
      url: "/admin/account/security",
      icon: ShieldCheck,
    },
  ],
}

export const dashboardNavigation = {
  navMain: [
    {
      title: "Tableau de bord",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Examen Blanc",
      url: "/dashboard/examen-blanc",
      icon: IconListDetails,
    },
    {
      title: "Entraînement",
      url: "/dashboard/entrainement",
      icon: IconChartBar,
    },
  ],
  navSecondary: [
    {
      title: "Profil",
      url: "/dashboard/profil",
      icon: User,
    },
    {
      title: "Abonnement",
      url: "/dashboard/account",
      icon: CreditCard,
    },
    {
      title: "Paramètres",
      url: "/dashboard/settings",
      icon: Settings,
    },
  ],
}

// Domaines médicaux prédéfinis
export const MEDICAL_DOMAINS = [
  "Anesthésie-Réanimation",
  "Autres",
  "Cardiologie",
  "Chirurgie",
  "Dermatologie",
  "Endocrinologie",
  "Gastro-entérologie",
  "Gastroentérologie",
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

// Liens du footer
export const FOOTER_QUICK_LINKS = [
  { name: "Accueil", href: "/" },
  { name: "Domaines", href: "/domaines" },
  { name: "Évaluation", href: "/evaluation" },
  { name: "À propos", href: "/a-propos" },
  { name: "Tarifs", href: "/tarifs" },
  { name: "FAQ", href: "/faq" },
] as const

export const FOOTER_LEGAL_LINKS = [
  {
    name: "Politique de confidentialité",
    href: "/confidentialite",
  },
  { name: "Conditions d'utilisation", href: "/conditions" },
  { name: "Cookies", href: "/cookies" },
] as const
