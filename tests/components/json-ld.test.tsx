import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { JsonLd } from "@/components/seo/json-ld"

describe("JsonLd", () => {
  it("une valeur ne peut pas fermer la balise script", () => {
    const { container } = render(
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Offer",
          name: "</script><script>alert(1)</script>",
        }}
      />,
    )
    const scripts = container.querySelectorAll("script")

    expect(scripts).toHaveLength(1)
    expect(JSON.parse(scripts[0].textContent ?? "").name).toBe(
      "</script><script>alert(1)</script>",
    )
  })
})
