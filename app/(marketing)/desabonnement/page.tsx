import type { Metadata } from "next"
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token"
import { UnsubscribeFlow } from "./_components/unsubscribe-flow"

export const metadata: Metadata = {
  title: "Désabonnement",
  robots: { index: false, follow: false },
  // Le jeton voyage en query string : ne jamais le laisser fuir par le Referer
  // (lien « préférences » vers le profil, ressources tierces).
  referrer: "no-referrer",
}

// Aucune écriture au rendu : les filtres de courriel (Safe Links) pré-visitent
// les liens. Le rendu vérifie seulement la signature du jeton ; l'écriture
// attend le clic sur le bouton.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const valid = verifyUnsubscribeToken(token) !== null
  return <UnsubscribeFlow token={valid ? (token ?? null) : null} />
}
