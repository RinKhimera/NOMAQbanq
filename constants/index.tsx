import {
  IconChartBar,
  IconDashboard,
  IconListDetails,
  // IconSettings,
  IconUsers,
} from "@tabler/icons-react"
import { CircleUserRound, ShieldCheck } from "lucide-react"

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
    // {
    //   title: "Paramètres",
    //   url: "#",
    //   icon: IconSettings,
    // },
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
    // {
    //   title: "Paramètres",
    //   url: "#",
    //   icon: IconSettings,
    // },
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
