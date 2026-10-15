import { faqPageJsonLd } from "@/lib/seo"
import { JsonLd } from "./json-ld"

interface FaqSchemaProps {
  questions: { q: string; a: string }[]
}

export function FaqSchema({ questions }: FaqSchemaProps) {
  return <JsonLd data={faqPageJsonLd(questions)} />
}
