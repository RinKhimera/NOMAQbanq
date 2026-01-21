import { Metadata } from "next"
import LegalPageLayout from "@/components/layout/legal-page-layout"
import { CookiesContent } from "./_components/cookies-content"

export const metadata: Metadata = {
  title: "Politique de cookies | NOMAQbanq",
  description:
    "Informations sur l'utilisation des cookies et traceurs sur la plateforme NOMAQbanq.",
}

const sections = [
  { id: "definition", title: "Qu'est-ce qu'un cookie ?" },
  { id: "types", title: "Types de cookies" },
  { id: "essentiels", title: "Cookies essentiels" },
  { id: "analytiques", title: "Cookies analytiques" },
  { id: "tiers", title: "Cookies tiers" },
  { id: "gestion", title: "Gestion des préférences" },
  { id: "duree", title: "Durée de conservation" },
  { id: "contact-cookies", title: "Contact" },
]

const CookiesPage = () => {
  return (
    <LegalPageLayout
      pageType="cookies"
      title="Politique de cookies"
      subtitle="Comprendre comment nous utilisons les cookies et traceurs pour améliorer votre expérience."
      lastUpdated="15 janvier 2026"
      articleNumber="03"
      sections={sections}
    >
      <CookiesContent />
    </LegalPageLayout>
  )
}

export default CookiesPage
