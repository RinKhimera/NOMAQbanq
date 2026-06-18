"use client"

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react"
import { MotionConfig } from "motion/react"
import { ReactNode } from "react"

// Clerk retiré (migration Better Auth). Convex reste monté avec un shim d'auth NEUTRE
// pendant la migration (Option C) : `useConvexAuth()` renvoie « non authentifié » partout,
// donc les écrans Convex pas encore convertis affichent un état vide au lieu de planter au
// prerender. Ce shim — et le client Convex — disparaissent avec `convex/` en fin de Phase 5.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

const useNoAuth = () => ({
  isLoading: false,
  isAuthenticated: false,
  fetchAccessToken: async () => null,
})

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useNoAuth}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ConvexProviderWithAuth>
  )
}
