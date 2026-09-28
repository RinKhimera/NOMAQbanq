import {
  type NavSection,
  adminNavSections,
  studentNavSections,
} from "@/constants"

export type ShellZone = "student" | "admin"

type TitledRoute = { title: string; url: string; inMenu: boolean }

const menuRoutes = (sections: NavSection[]): TitledRoute[] =>
  sections.flatMap((section) =>
    section.items.map(({ title, url }) => ({ title, url, inMenu: true })),
  )

const ZONES: Record<
  ShellZone,
  { root: string; fallback: string; routes: TitledRoute[] }
> = {
  student: {
    root: "/tableau-de-bord",
    fallback: "Tableau de bord",
    routes: [
      ...menuRoutes(studentNavSections),
      // Pages atteintes sans lien de menu (onboarding, retour Stripe).
      { title: "Bienvenue", url: "/tableau-de-bord/bienvenue", inMenu: false },
      { title: "Paiement", url: "/tableau-de-bord/paiement", inMenu: false },
    ],
  },
  admin: {
    root: "/admin",
    fallback: "Administration",
    routes: menuRoutes(adminNavSections),
  },
}

// Préfixe de segment le plus long : une sous-page (`/examen-blanc/[id]/evaluation`)
// relève de sa section. La racine de zone ne vaut que pour elle-même, sinon elle
// préfixerait toutes les routes et le repli serait inatteignable.
const matchRoute = (pathname: string, zone: ShellZone) => {
  const { root, routes } = ZONES[zone]
  return routes
    .filter(
      (route) =>
        pathname === route.url ||
        (route.url !== root && pathname.startsWith(`${route.url}/`)),
    )
    .sort((a, b) => b.url.length - a.url.length)[0]
}

/** Titre de la barre du haut, dérivé de l'URL. */
export const pageTitle = (pathname: string, zone: ShellZone): string =>
  matchRoute(pathname, zone)?.title ?? ZONES[zone].fallback

/** URL du lien de navigation à marquer comme page courante. */
export const activeNavUrl = (
  pathname: string,
  zone: ShellZone,
): string | null => {
  const route = matchRoute(pathname, zone)
  return route?.inMenu ? route.url : null
}

/** Groupes de la SideNav d'une zone. */
export const navSections = (zone: ShellZone): NavSection[] =>
  zone === "admin" ? adminNavSections : studentNavSections
