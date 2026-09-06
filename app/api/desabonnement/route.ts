import { NextResponse } from "next/server"
import { applyMarketingPreferenceByToken } from "@/features/notifications/unsubscribe"

// Désabonnement en un clic (RFC 8058) : Gmail et les autres webmails envoient un
// POST `List-Unsubscribe=One-Click` sur l'URL de l'en-tête `List-Unsubscribe`,
// après avoir demandé confirmation à l'utilisateur dans leur propre interface.
// Les scanners de liens n'émettent jamais de POST : pas de désabonnement
// involontaire. Un GET (client qui ouvre l'URL dans un navigateur) renvoie
// vers la page de confirmation.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token")
  const outcome = await applyMarketingPreferenceByToken(token, false)
  return outcome === "updated"
    ? new Response(null, { status: 200 })
    : new Response("Lien invalide", { status: 400 })
}

export function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token") ?? ""
  return NextResponse.redirect(
    new URL(`/desabonnement?token=${encodeURIComponent(token)}`, url.origin),
    302,
  )
}
