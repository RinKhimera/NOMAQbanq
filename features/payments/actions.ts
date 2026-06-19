"use server"

import { requireSession } from "@/lib/auth-guards"

import { getMyTransactions, type MyTransactionsPage } from "./dal"

/**
 * Charge la page suivante de l'historique des transactions de l'utilisateur
 * courant (pagination keyset). Remplace `usePaginatedQuery` côté client :
 * appelée dans un `startTransition` par le bouton « Charger plus ».
 */
export const loadMoreMyTransactions = async (
  cursor: string,
): Promise<MyTransactionsPage> => {
  await requireSession()
  return getMyTransactions({ cursor })
}
