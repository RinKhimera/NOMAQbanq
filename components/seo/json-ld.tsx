import type { JsonLdData } from "@/lib/seo"

interface JsonLdProps {
  data: JsonLdData | JsonLdData[]
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // `<` échappé : une valeur venue de la base (nom, description d'un
      // produit) ne doit pas pouvoir fermer la balise `<script>`.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
