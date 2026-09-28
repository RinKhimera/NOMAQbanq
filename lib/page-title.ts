import { adminNavSections, studentNavSections } from "@/constants"

export type ShellZone = "student" | "admin"

type TitledRoute = { title: string; url: string }

const ZONES: Record<
  ShellZone,
  { root: string; fallback: string; routes: TitledRoute[] }
> = {
  student: {
    root: "/tableau-de-bord",
    fallback: "Tableau de bord",
    routes: [
      ...studentNavSections.flatMap((section) => section.items),
      // Pages atteintes sans lien de menu (onboarding, retour Stripe).
      { title: "Bienvenue", url: "/tableau-de-bord/bienvenue" },
      { title: "Paiement", url: "/tableau-de-bord/paiement" },
    ],
  },
  admin: {
    root: "/admin",
    fallback: "Administration",
    routes: adminNavSections.flatMap((section) => section.items),
  },
}

/** Titre de la barre du haut, dérivé de l'URL. */
export const pageTitle = (pathname: string, zone: ShellZone): string => {
  const { root, fallback, routes } = ZONES[zone]

  // Préfixe de segment le plus long : une sous-page (`/examen-blanc/[id]/evaluation`)
  // garde le titre de sa section. La racine de zone ne vaut que pour elle-même,
  // sinon elle préfixerait toutes les routes et le repli serait inatteignable.
  const match = routes
    .filter(
      (route) =>
        pathname === route.url ||
        (route.url !== root && pathname.startsWith(`${route.url}/`)),
    )
    .sort((a, b) => b.url.length - a.url.length)[0]

  return match?.title ?? fallback
}
