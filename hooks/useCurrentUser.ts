import { authClient } from "@/lib/auth-client"
import { resolveAvatarUrl } from "@/lib/cdn"

/**
 * Session courante via Better Auth (remplace l'ancien combo Convex/Clerk).
 * Conserve la forme `{ currentUser, isLoading, isAuthenticated }` attendue par les
 * consommateurs. `currentUser` porte id/name/email/image/role/username/bio.
 *
 * `image` est résolu en URL affichable : les clés de stockage S3 (uploads app)
 * deviennent des URL CDN, les avatars OAuth (Google) restent intacts.
 */
export const useCurrentUser = () => {
  const { data, isPending } = authClient.useSession()
  const user = data?.user ?? null

  return {
    currentUser: user ? { ...user, image: resolveAvatarUrl(user.image) } : null,
    isLoading: isPending,
    isAuthenticated: !!user,
  }
}
