import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/admin(.*)"])
const isPublicRoute = createRouteMatcher(["/", "/a-propos", "/domaines"])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  // Si l'utilisateur est connecté et tente d'accéder aux pages vitrine
  if (userId && isPublicRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // Protection des routes protégées
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
