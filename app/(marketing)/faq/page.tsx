import { Metadata } from "next"
import { CtaBand } from "@/components/marketing/cta-band"
import { FaqSchema } from "@/components/seo/faq-schema"
import { SITE_OG_IMAGE, SITE_OPEN_GRAPH, SITE_URL } from "@/lib/seo"
import FaqPageClient from "./_components/faq-page-client"
import { getAllFaqQuestions } from "./_data/faq-data"

export const metadata: Metadata = {
  title: "FAQ - Questions fréquentes",
  description:
    "Questions fréquentes sur NOMAQbanq : inscription, abonnements, fonctionnement des QCM, examens blancs, support technique. Trouvez rapidement vos réponses.",
  alternates: {
    canonical: `${SITE_URL}/faq`,
    languages: {
      "fr-CA": `${SITE_URL}/faq`,
    },
  },
  openGraph: {
    ...SITE_OPEN_GRAPH,
    url: `${SITE_URL}/faq`,
    title: "FAQ - Questions fréquentes",
    description:
      "Trouvez les réponses à vos questions sur la préparation EACMC : inscription, tarifs, fonctionnement de la plateforme et support.",
    images: [SITE_OG_IMAGE],
  },
}

export default function FAQPage() {
  const allQuestions = getAllFaqQuestions()

  return (
    <>
      <FaqSchema questions={allQuestions} />
      <FaqPageClient />
      <CtaBand />
    </>
  )
}
