import type { Metadata } from "next"
import { Suspense } from "react"
import { OAuthErrorHandler } from "./_components/oauth-error-handler"
import { SignInForm } from "./_components/sign-in-form"

export const metadata: Metadata = { title: "Connexion" }

export default function ConnexionPage() {
  return (
    <>
      <Suspense fallback={null}>
        <OAuthErrorHandler />
      </Suspense>
      <SignInForm />
    </>
  )
}
