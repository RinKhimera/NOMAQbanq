import { getSessionCookie } from "better-auth/cookies"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Check OPTIMISTE de présence du cookie de session (pas de validation DB ici — rapide,
// edge-friendly). La vraie vérification (et le rôle admin) se fait dans la DAL/guards
// (`requireSession`/`requireRole`) côté Server Component. Défense en profondeur.
const PROTECTED = [/^\/dashboard(?:\/|$)/, /^\/admin(?:\/|$)/]
const PUBLIC_ONLY = [/^\/$/, /^\/a-propos$/, /^\/domaines$/]

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = Boolean(getSessionCookie(request))

  // Connecté sur une page vitrine → renvoyer vers l'app.
  if (hasSession && PUBLIC_ONLY.some((re) => re.test(pathname))) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Non connecté sur une route protégée → renvoyer vers la connexion.
  if (!hasSession && PROTECTED.some((re) => re.test(pathname))) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
