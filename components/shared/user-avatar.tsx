"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { resolveAvatarUrl } from "@/lib/cdn"
import { getInitials } from "@/lib/utils"

type UserAvatarProps = {
  name: string | null | undefined
  /** `user.image` polymorphe : clé S3 brute (legacy), URL Google/CDN, data:, ou null. */
  image: string | null | undefined
  /** Classes du conteneur Avatar (taille, ring, border, ombre). */
  className?: string
  /** Classes du fallback initiales (gradient/couleurs du contexte appelant). */
  fallbackClassName?: string
}

/**
 * Avatar utilisateur unique de l'app. Résout les `user.image` polymorphes
 * (clé brute → URL CDN de l'env courant) et rend les initiales en fallback —
 * y compris quand l'image échoue à charger (comportement natif Radix).
 * Toujours utiliser CE composant pour un avatar, jamais `AvatarImage` brut.
 */
export const UserAvatar = ({
  name,
  image,
  className,
  fallbackClassName,
}: UserAvatarProps) => (
  <Avatar className={className}>
    <AvatarImage src={resolveAvatarUrl(image) ?? undefined} alt={name ?? ""} />
    <AvatarFallback className={fallbackClassName}>
      {getInitials(name)}
    </AvatarFallback>
  </Avatar>
)
