import { getSessionCookie } from "better-auth/cookies"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Seule responsabilité : un visiteur déjà connecté n'a rien à faire sur les
// pages vitrine listées dans `config.matcher` → tableau de bord. Détection
// OPTIMISTE par présence du cookie (aucune validation DB ici).
//
// La zone protégée n'est PAS gardée ici mais dans les layouts `(dashboard)` /
// `(admin)` (`requireSession` / `requireRole`) et dans chaque Server Action.
// Ce proxy est une fonction facturée en CPU actif à CHAQUE requête qu'il
// matche : un matcher large (`/api`, dashboard, prefetch…) multiplie les
// invocations sans rien garder de plus. Ne pas l'élargir.
export default function proxy(request: NextRequest) {
  if (getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/tableau-de-bord", request.url))
  }
  return NextResponse.next()
}

// `has` cookie sans `value` = test de présence, évalué avant d'invoquer la
// fonction : bots et anonymes (la majorité du trafic de `/`) ne la réveillent
// plus. Deux noms : `__Secure-` en HTTPS, nu en HTTP. Littéraux obligatoires
// (analyse statique au build), d'où la répétition. Les noms sont les défauts
// de Better Auth (`getCookies`, better-auth/cookies) : toute option
// `advanced.cookiePrefix` / `cookies.session_token.name` ajoutée à `lib/auth.ts`
// se répercute ici — `tests/proxy.test.ts` le vérifie.
export const config = {
  matcher: [
    {
      source: "/",
      has: [{ type: "cookie", key: "__Secure-better-auth.session_token" }],
    },
    {
      source: "/",
      has: [{ type: "cookie", key: "better-auth.session_token" }],
    },
    {
      source: "/a-propos",
      has: [{ type: "cookie", key: "__Secure-better-auth.session_token" }],
    },
    {
      source: "/a-propos",
      has: [{ type: "cookie", key: "better-auth.session_token" }],
    },
    {
      source: "/domaines",
      has: [{ type: "cookie", key: "__Secure-better-auth.session_token" }],
    },
    {
      source: "/domaines",
      has: [{ type: "cookie", key: "better-auth.session_token" }],
    },
  ],
}
