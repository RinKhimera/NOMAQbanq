import { Metadata } from "next"
import { FaqSchema } from "@/components/seo/faq-schema"
import FaqPageClient from "./_components/faq-page-client"
import { getAllFaqQuestions } from "./_data/faq-data"

export const metadata: Metadata = {
  title: "FAQ - Questions fréquentes",
  description:
    "Questions fréquentes sur NOMAQbanq : inscription, abonnements, fonctionnement des QCM, examens blancs, support technique. Trouvez rapidement vos réponses.",
  alternates: {
    canonical: "https://nomaqbanq.ca/faq",
    languages: {
      "fr-CA": "https://nomaqbanq.ca/faq",
    },
  },
  openGraph: {
    title: "FAQ - Questions fréquentes | NOMAQbanq",
    description:
      "Trouvez les réponses à vos questions sur la préparation EACMC : inscription, tarifs, fonctionnement de la plateforme et support.",
    images: [
      {
        url: "/images/home-image.jpg",
        width: 1200,
        height: 630,
        alt: "NOMAQbanq FAQ - Questions fréquentes",
      },
    ],
  },
}

export default function FAQPage() {
  const allQuestions = getAllFaqQuestions()

  return (
    <>
      <FaqSchema questions={allQuestions} />
      <FaqPageClient />
    </>
  )
}
