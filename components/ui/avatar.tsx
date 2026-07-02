"use client"

import * as AvatarPrimitive from "@radix-ui/react-avatar"
import * as React from "react"
import { resolveAvatarUrl } from "@/lib/cdn"
import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  src,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  // `user.image` est polymorphe : URL absolue (Google/CDN) OU clé S3 brute
  // (avatars héritées de la migration). On normalise ICI, au seul point de rendu,
  // pour qu'une clé brute ne soit jamais interprétée comme une URL relative (→ 404).
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      src={
        resolveAvatarUrl(typeof src === "string" ? src : undefined) ?? undefined
      }
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className,
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
