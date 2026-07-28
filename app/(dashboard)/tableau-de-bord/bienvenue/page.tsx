import type { Metadata } from "next"
import { requireSession } from "@/lib/auth-guards"
import { OnboardingForm } from "./_components/onboarding-form"

export const metadata: Metadata = { title: "Bienvenue" }

export default async function BienvenuePage() {
  const session = await requireSession()

  return (
    <OnboardingForm
      defaultName={session.user.name ?? ""}
      defaultBio={session.user.bio ?? ""}
    />
  )
}
