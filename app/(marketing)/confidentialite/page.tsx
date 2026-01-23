import { Metadata } from "next"
import LegalPageLayout from "@/components/layout/legal-page-layout"
import { PrivacyContent } from "./_components/privacy-content"

export const metadata: Metadata = {
  title: "Politique de confidentialité | NOMAQbanq",
  description:
    "Découvrez comment NOMAQbanq protège vos données personnelles et respecte votre vie privée.",
  alternates: {
    canonical: "https://nomaqbanq.ca/confidentialite",
  },
}

const sections = [
  { id: "collecte", title: "Données collectées" },
  { id: "finalites", title: "Finalités du traitement" },
  { id: "base-legale", title: "Base légale" },
  { id: "destinataires", title: "Destinataires" },
  { id: "securite", title: "Sécurité" },
  { id: "conservation", title: "Conservation" },
  { id: "droits", title: "Vos droits" },
  { id: "transferts", title: "Transferts internationaux" },
  { id: "mineurs", title: "Mineurs" },
  { id: "contact-dpo", title: "Contact DPO" },
]

const ConfidentialitePage = () => {
  return (
    <LegalPageLayout
      pageType="confidentialite"
      title="Politique de confidentialité"
      subtitle="Comment nous protégeons vos données personnelles et respectons votre vie privée."
      lastUpdated="15 janvier 2026"
      articleNumber="02"
      sections={sections}
    >
      <PrivacyContent />
    </LegalPageLayout>
  )
}

export default ConfidentialitePage
