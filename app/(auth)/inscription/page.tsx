import type { Metadata } from "next"
import { SignUpForm } from "./_components/sign-up-form"

export const metadata: Metadata = { title: "Inscription" }

export default function InscriptionPage() {
  return <SignUpForm />
}
