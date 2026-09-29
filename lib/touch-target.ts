/**
 * Zone de toucher de 44 px pour un bouton de 32 px dans une ligne de tableau ou
 * de liste : sur mobile, un pseudo-élément déborde de 10 px de chaque côté sans
 * changer la taille visible du bouton (`design-system.md`, « Hauteurs »).
 */
export const TOUCH_TARGET =
  "relative max-md:after:absolute max-md:after:-inset-2.5 max-md:after:content-['']"
