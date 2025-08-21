import {
  IconChartBar,
  IconDashboard,
  IconListDetails,
  IconUsers,
} from "@tabler/icons-react"
import { CircleUserRound, ShieldCheck, User } from "lucide-react"

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
      title: "Examens",
      url: "/admin/exams",
      icon: IconChartBar,
    },
    {
      title: "Utilisateurs",
      url: "/admin/users",
      icon: IconUsers,
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
      url: "/dashboard/mock-exam",
      icon: IconListDetails,
    },
    {
      title: "Entraînement",
      url: "/dashboard/training",
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
      title: "Compte",
      url: "/dashboard/account",
      icon: CircleUserRound,
    },
    {
      title: "Sécurité",
      url: "/dashboard/account/security",
      icon: ShieldCheck,
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
  "Orthopédie",
  "Pédiatrie",
  "Pneumologie",
  "Psychiatrie",
  "Santé publique et médecine préventive",
  "Urologie",
] as const

// Type dérivé des domaines médicaux
export type MedicalDomain = (typeof MEDICAL_DOMAINS)[number]

// Fonction helper pour vérifier si une string est un domaine médical valide
export const isMedicalDomain = (domain: string): domain is MedicalDomain => {
  return MEDICAL_DOMAINS.includes(domain as MedicalDomain)
}
