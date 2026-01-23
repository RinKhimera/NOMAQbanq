import { Metadata } from "next"
import DomainesPageClient from "./_components/domaines-page-client"

export const metadata: Metadata = {
  title: "Domaines médicaux",
  description:
    "Explorez nos 23 domaines médicaux : cardiologie, pédiatrie, chirurgie, neurologie et plus. Questions EACMC organisées par spécialité pour une préparation ciblée.",
  alternates: {
    canonical: "https://nomaqbanq.ca/domaines",
  },
}

export default function DomainesPage() {
  return <DomainesPageClient />
}
