// Liens vers les pages de l'administration, sans dépendance : importables
// d'un composant comme d'un module serveur (courriels d'alerte).

export const ADMIN_PROFILE_PATH = "/admin/profil"

/** Dossier d'un client sur la page Transactions, transaction dépliée. */
export const clientFileHref = (userId: string, transactionId?: string) => {
  const params = new URLSearchParams({ client: userId })
  if (transactionId) params.set("tx", transactionId)
  return `/admin/transactions?${params}`
}

export const adminUserHref = (userId: string) => `/admin/utilisateurs/${userId}`

export const adminExamHref = (examId: string) => `/admin/examens/${examId}`

export const adminQuestionHref = (questionId: string) =>
  `/admin/questions/${questionId}`

/** Tableau de suivi de la progression des étudiants. */
export const ADMIN_PROGRESSION_HREF = "/admin/progression"

/** Progression d'un étudiant, ouverte hors du tableau (fiche, lien direct). */
export const adminProgressionHref = (userId: string) =>
  `${ADMIN_PROGRESSION_HREF}/${userId}`
