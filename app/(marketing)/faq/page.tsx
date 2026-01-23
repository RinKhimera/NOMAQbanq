import { Metadata } from "next"
import FaqPageClient from "./_components/faq-page-client"

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Questions fréquentes sur NOMAQbanq : inscription, abonnements, fonctionnement des QCM, examens blancs, support technique. Trouvez rapidement vos réponses.",
  alternates: {
    canonical: "https://nomaqbanq.ca/faq",
  },
}

export default function FAQPage() {
  return <FaqPageClient />
}
