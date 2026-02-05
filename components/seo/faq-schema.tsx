import { JsonLd } from "./json-ld"

interface FaqQuestion {
  q: string
  a: string
}

interface FaqSchemaProps {
  questions: FaqQuestion[]
}

export function FaqSchema({ questions }: FaqSchemaProps) {
  const faqPageSchema = {
    "@context": "https://schema.org" as const,
    "@type": "FAQPage" as const,
    mainEntity: questions.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  }

  return <JsonLd data={faqPageSchema} />
}
