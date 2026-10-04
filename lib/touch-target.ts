/**
 * Zone de toucher de 44 px pour un bouton de 32 px dans une ligne de tableau ou
 * de liste : sur mobile, un pseudo-élément déborde de 10 px de chaque côté sans
 * changer la taille visible du bouton (`design-system.md`, « Hauteurs »). Un
 * bouton déjà positionné (`absolute`, sur une vignette) le reste :
 * `cn(TOUCH_TARGET, "absolute …")` remplace `relative`.
 */
export const TOUCH_TARGET =
  "relative max-md:after:absolute max-md:after:-inset-2.5 max-md:after:content-['']"

/**
 * Contrôle porté à 44 px de haut sous 1024 px et sur écran tactile (iPad en
 * paysage compris) : boutons de pagination, lignes et actions d'une liste
 * dense. `TOUCH_MIN_HEIGHT` pour une ligne dont le contenu peut dépasser.
 */
export const TOUCH_HEIGHT = "max-lg:h-11 pointer-coarse:h-11"
export const TOUCH_MIN_HEIGHT = "max-lg:min-h-11 pointer-coarse:min-h-11"
/** Bouton icône carré porté à 44 × 44 px dans les mêmes conditions. */
export const TOUCH_SIZE = "max-lg:size-11 pointer-coarse:size-11"
