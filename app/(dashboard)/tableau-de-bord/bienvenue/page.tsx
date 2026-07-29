import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireSession } from "@/lib/auth-guards"
import { OnboardingForm } from "./_components/onboarding-form"

export const metadata: Metadata = { title: "Bienvenue" }

export default async function BienvenuePage() {
  const session = await requireSession()

  // Garde SERVEUR : sans lui, un utilisateur déjà onboardé reçoit un formulaire
  // prérempli et soumettable le temps qu'OnboardingGuard s'hydrate — or
  // `updateProfile` s'exclut lui-même du contrôle d'unicité
  // (`features/users/actions.ts`), donc il pourrait écraser son propre username.
  if (session.user.username) redirect("/tableau-de-bord")

  return (
    <OnboardingForm
      defaultName={session.user.name ?? ""}
      defaultBio={session.user.bio ?? ""}
    />
  )
}
