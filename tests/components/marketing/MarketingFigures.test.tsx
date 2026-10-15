import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MarketingFigures } from "@/components/marketing/marketing-figures"

const figure = (n: number) => ({ value: String(n), label: `chiffre ${n}` })
const cells = (container: HTMLElement) =>
  [...container.querySelectorAll("dl > div")] as HTMLElement[]

describe("MarketingFigures en bande", () => {
  it("3 chiffres : trois colonnes, et le dernier prend la ligne sous 768 px", () => {
    const { container } = render(
      <MarketingFigures figures={[1, 2, 3].map(figure)} />,
    )

    expect(container.querySelector("dl")).toHaveClass("md:grid-cols-3")
    expect(cells(container).at(-1)).toHaveClass("max-md:col-span-2")
    expect(cells(container)[0]).not.toHaveClass("max-md:col-span-2")
  })

  it("4 chiffres : quatre colonnes, aucune case étendue", () => {
    const { container } = render(
      <MarketingFigures figures={[1, 2, 3, 4].map(figure)} />,
    )

    expect(container.querySelector("dl")).toHaveClass("md:grid-cols-4")
    for (const cell of cells(container)) {
      expect(cell).not.toHaveClass("max-md:col-span-2")
    }
  })
})
