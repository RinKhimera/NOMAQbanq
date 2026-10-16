import { Metadata } from "next"
import { CtaBand } from "@/components/marketing/cta-band"
import { FaqSchema } from "@/components/seo/faq-schema"
import { MARKETING_PATHS } from "@/constants"
import { pageMetadata } from "@/lib/seo"
import FaqPageClient from "./_components/faq-page-client"
import { getAllFaqQuestions } from "./_data/faq-data"

export const metadata: Metadata = pageMetadata(MARKETING_PATHS.faq, {
  title: "FAQ - Questions fréquentes",
  description:
    "Questions fréquentes sur l'EACMC partie 1 et sur NOMAQbanq : format et inscription à l'examen, abonnements, fonctionnement des QCM, examens blancs, support.",
  ogDescription:
    "Trouvez les réponses à vos questions sur la préparation EACMC : inscription, tarifs, fonctionnement de la plateforme et support.",
})

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
