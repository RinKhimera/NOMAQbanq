/** `page` sur la page du lien, `true` sur une sous-page de sa rubrique (`/domaines/[slug]`). */
export const navCurrent = (
  pathname: string,
  href: string,
): "page" | "true" | undefined => {
  if (pathname === href) return "page"
  if (href !== "/" && pathname.startsWith(`${href}/`)) return "true"
  return undefined
}
