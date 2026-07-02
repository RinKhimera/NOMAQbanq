import { getSessionCookie } from "better-auth/cookies"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Check OPTIMISTE de présence du cookie de session (pas de validation DB ici — rapide,
// edge-friendly). La vraie vérification (et le rôle admin) se fait dans la DAL/guards
// (`requireSession`/`requireRole`) côté Server Component. Défense en profondeur.
const PROTECTED = [/^\/dashboard(?:\/|$)/, /^\/admin(?:\/|$)/]
const PUBLIC_ONLY = [/^\/$/, /^\/a-propos$/, /^\/domaines$/]

// ----- Mode maintenance (« blocus »), gardé par MAINTENANCE_MODE -----
// Gel GLOBAL des écritures pendant la bascule Convex → Neon : 503 sur toutes les
// routes (Server Actions incluses → aucune écriture DB ne passe). Lu DIRECTEMENT
// depuis process.env (le proxy doit rester autonome) ; un changement de variable
// exige un redéploiement Vercel. ⚠️ Ce proxy vit dans la NOUVELLE app : déployer
// cette branche AVEC MAINTENANCE_MODE=1 remplace l'ancienne app Convex → Convex
// cesse d'être écrit → snapshot cohérent → import Neon → puis lever la maintenance.
const BYPASS_COOKIE = "nomaq_maintenance_bypass"
const MAINTENANCE_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex"/><title>Maintenance — NOMAQbanq</title><style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1120;color:#e2e8f0}main{max-width:32rem;padding:2rem;text-align:center}h1{font-size:1.5rem;margin-bottom:.75rem}p{color:#94a3b8;line-height:1.6;margin:0}</style></head><body><main><h1>Maintenance en cours</h1><p>NOMAQbanq est momentanément indisponible pendant une mise à jour. Merci de réessayer dans quelques minutes.</p></main></body></html>`

const maintenanceResponse = (): NextResponse =>
  new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "3600",
      "Cache-Control": "no-store",
    },
  })

// 503 partout quand MAINTENANCE_MODE=1, sauf contournement ops : `?bypass=<token>`
// pose un cookie (→ smoke-test avant réouverture). Renvoie null si la maintenance
// est inactive (ou bypass valide) → le proxy poursuit avec la logique de session.
const maintenanceGate = (request: NextRequest): NextResponse | null => {
  if (process.env.MAINTENANCE_MODE !== "1") return null
  const token = process.env.MAINTENANCE_BYPASS_TOKEN
  if (token) {
    if (request.nextUrl.searchParams.get("bypass") === token) {
      const res = NextResponse.redirect(
        new URL(request.nextUrl.pathname, request.nextUrl),
      )
      res.cookies.set(BYPASS_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
      return res
    }
    if (request.cookies.get(BYPASS_COOKIE)?.value === token) return null
  }
  return maintenanceResponse()
}

export default function proxy(request: NextRequest) {
  const maintenance = maintenanceGate(request)
  if (maintenance) return maintenance

  const { pathname } = request.nextUrl
  const hasSession = Boolean(getSessionCookie(request))

  // Connecté sur une page vitrine → renvoyer vers l'app.
  if (hasSession && PUBLIC_ONLY.some((re) => re.test(pathname))) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Non connecté sur une route protégée → renvoyer vers la connexion.
  if (!hasSession && PROTECTED.some((re) => re.test(pathname))) {
    return NextResponse.redirect(new URL("/connexion", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
