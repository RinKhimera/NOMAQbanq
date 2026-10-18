/** Lignes par page du suivi admin de la progression (DAL et écran). */
export const STUDENT_PROGRESS_PAGE_SIZE = 20

/** Page du tableau qui contient la ligne `position` (1-based). */
export const pageOfPosition = (position: number) =>
  Math.floor((position - 1) / STUDENT_PROGRESS_PAGE_SIZE) + 1
