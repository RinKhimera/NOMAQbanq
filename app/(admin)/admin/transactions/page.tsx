import type { Metadata } from "next"
import {
  getAvailableProducts,
  getTransactionClientFile,
  getTransactionClients,
  getTransactionStats,
} from "@/features/payments/dal"
import { currentTimeMs } from "@/lib/clock"
import { parseClientFilter } from "./_components/transaction-params"
import { TransactionsClient } from "./_components/transactions-client"

export const metadata: Metadata = { title: "Transactions" }

const one = (v: string | string[] | undefined) =>
  typeof v === "string" && v ? v : undefined

/**
 * Dossier client : tout l'état vit dans l'URL — recherche `q`, filtre
 * `filtre`, tranche de la liste (`apres` / `avant`, curseurs keyset), client
 * ouvert `client` et transaction dépliée `tx`. Le dossier se charge
 * indépendamment de la tranche ; un lien vers une transaction précise (sans
 * curseur) place la liste sur la tranche de son client.
 */
export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const q = one(params.q) ?? ""
  const filter = parseClientFilter(one(params.filtre))
  const clientId = one(params.client)
  const txId = one(params.tx)
  const after = one(params.apres)
  const before = one(params.avant)

  const [stats, clients, products, file] = await Promise.all([
    getTransactionStats(),
    getTransactionClients({
      q,
      filter,
      after,
      before,
      around: !after && !before && txId ? clientId : undefined,
    }),
    getAvailableProducts(),
    clientId
      ? getTransactionClientFile(clientId, { throughTransactionId: txId })
      : null,
  ])

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <TransactionsClient
        stats={stats}
        clients={clients}
        q={q}
        filter={filter}
        clientId={clientId ?? null}
        file={file}
        txId={txId ?? null}
        products={products}
        initialNow={currentTimeMs()}
      />
    </div>
  )
}
