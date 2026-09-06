"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"

// Better Auth redirige les erreurs du callback OAuth vers l'`errorCallbackURL`
// avec `?error=<code>`. Monté dans un <Suspense> : useSearchParams ferait
// sinon basculer la page statique en rendu dynamique.
export const OAuthErrorHandler = () => {
  const router = useRouter()
  const error = useSearchParams().get("error")

  useEffect(() => {
    if (!error) return
    if (error === "BANNED_USER") {
      router.replace("/compte-suspendu")
      return
    }
    toast.error("La connexion avec Google a échoué. Réessayez.")
    router.replace("/connexion")
  }, [error, router])

  return null
}
