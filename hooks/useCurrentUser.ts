import { authClient } from "@/lib/auth-client"

/**
 * Session courante via Better Auth (remplace l'ancien combo Convex/Clerk).
 * Conserve la forme `{ currentUser, isLoading, isAuthenticated }` attendue par les
 * consommateurs. `currentUser` porte id/name/email/image/role/username/bio.
 */
export const useCurrentUser = () => {
  const { data, isPending } = authClient.useSession()

  return {
    currentUser: data?.user ?? null,
    isLoading: isPending,
    isAuthenticated: !!data?.user,
  }
}
