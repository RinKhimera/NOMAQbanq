"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

const ONBOARDING_PATH = "/tableau-de-bord/bienvenue"

type OnboardingGuardProps = {
  hasUsername: boolean
}

// Reçoit l'état de la session résolue par le layout serveur : relire la session
// côté client coûterait un `get-session` (invocation + Neon) à chaque page.
// Le layout ne connaît pas `pathname`, d'où le composant client.
//
// Cette prop vient d'un layout qui ne se re-rend PAS à la navigation client :
// c'est le `router.refresh()` de fin d'onboarding (`onboarding-form.tsx`) qui
// la rafraîchit. Sans lui, elle resterait fausse et ce guard renverrait vers
// l'onboarding.
export const OnboardingGuard = ({ hasUsername }: OnboardingGuardProps) => {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const onOnboarding = pathname === ONBOARDING_PATH

    if (!hasUsername && !onOnboarding) {
      router.replace(ONBOARDING_PATH)
    } else if (hasUsername && onOnboarding) {
      router.replace("/tableau-de-bord")
    }
  }, [hasUsername, pathname, router])

  return null
}
