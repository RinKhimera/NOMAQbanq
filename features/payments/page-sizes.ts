// Tailles des listes paginées des paiements, partagées par le DAL et les
// écrans (module sans dépendance serveur).

/** Lignes par page de l'historique des paiements (page Abonnements). */
export const MY_TRANSACTIONS_PAGE_SIZE = 10
/** Clients par tranche dans la liste des transactions admin. */
export const CLIENT_PAGE_SIZE = 20
/** Transactions de la chronologie d'un dossier affichées d'emblée. */
export const TIMELINE_FIRST = 8
/** Transactions ajoutées par « Afficher … plus anciennes ». */
export const TIMELINE_MORE = 20
