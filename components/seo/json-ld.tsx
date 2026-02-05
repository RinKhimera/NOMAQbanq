type JsonLdData = {
  "@context": "https://schema.org"
  "@type": string
  [key: string]: unknown
}

interface JsonLdProps {
  data: JsonLdData | JsonLdData[]
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
