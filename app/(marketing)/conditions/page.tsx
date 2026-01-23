import { Metadata } from "next"
import LegalPageLayout from "@/components/layout/legal-page-layout"
import { ConditionsContent } from "./_components/conditions-content"

export const metadata: Metadata = {
  title: "Conditions d'utilisation | NOMAQbanq",
  description:
    "Conditions générales d'utilisation de la plateforme NOMAQbanq pour la préparation à l'EACMC Partie I.",
  alternates: {
    canonical: "https://nomaqbanq.ca/conditions",
  },
}

const sections = [
  { id: "objet", title: "Objet et acceptation" },
  { id: "services", title: "Description des services" },
  { id: "compte", title: "Création de compte" },
  { id: "obligations", title: "Obligations de l'utilisateur" },
  { id: "propriete", title: "Propriété intellectuelle" },
  { id: "paiement", title: "Tarification et paiement" },
  { id: "responsabilite", title: "Limitation de responsabilité" },
  { id: "resiliation", title: "Résiliation" },
  { id: "modifications", title: "Modifications des conditions" },
  { id: "contact", title: "Contact" },
]

const ConditionsPage = () => {
  return (
    <LegalPageLayout
      pageType="conditions"
      title="Conditions d'utilisation"
      subtitle="Les règles qui régissent l'utilisation de notre plateforme de préparation à l'EACMC."
      lastUpdated="15 janvier 2026"
      articleNumber="01"
      sections={sections}
    >
      <ConditionsContent />
    </LegalPageLayout>
  )
}

export default ConditionsPage
