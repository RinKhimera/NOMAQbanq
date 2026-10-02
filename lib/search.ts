/**
 * Forme de comparaison d'une recherche locale : casse, accents et espaces
 * superflus ignorés (« aigue  » trouve « Aiguë »). Appliquée au texte cherché
 * comme à la saisie.
 */
export const foldForSearch = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
