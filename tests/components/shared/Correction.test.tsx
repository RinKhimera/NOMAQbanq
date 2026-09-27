import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  CorrectionExplanation,
  CorrectionReferences,
} from "@/components/shared/correction"

const REFS = ["Source A", "Source B", "Source C", "Source D", "Source E"]

const openCitation = (label: string) => {
  fireEvent.click(screen.getByRole("button", { name: label }))
  return screen.getByRole("dialog")
}

describe("CorrectionExplanation", () => {
  it("une ligne vide sépare deux paragraphes, un retour simple reste dans le paragraphe", () => {
    const { container } = render(
      <CorrectionExplanation
        explanation={"Premier.\nSuite du premier.\n\n\nSecond."}
        references={[]}
      />,
    )
    const paragraphs = container.querySelectorAll("p")
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].textContent).toBe("Premier.\nSuite du premier.")
    expect(paragraphs[1].textContent).toBe("Second.")
  })

  it("un appel simple ouvre une bulle avec la référence visée", () => {
    render(
      <CorrectionExplanation
        explanation="La glycémie monte [2]."
        references={REFS}
      />,
    )
    const bubble = openCitation("Voir la référence 2")
    expect(within(bubble).getByText("Source B")).toBeInTheDocument()
    expect(within(bubble).queryByText("Source A")).not.toBeInTheDocument()
  })

  it("une plage est développée dans la bulle", () => {
    render(
      <CorrectionExplanation explanation="Texte [3-5]." references={REFS} />,
    )
    const bubble = openCitation("Voir les références 3, 4, 5")
    for (const ref of ["Source C", "Source D", "Source E"]) {
      expect(within(bubble).getByText(ref)).toBeInTheDocument()
    }
    expect(within(bubble).queryByText("Source B")).not.toBeInTheDocument()
  })

  it("une liste à virgules ouvre chacune de ses références", () => {
    render(
      <CorrectionExplanation explanation="Texte [1, 4]." references={REFS} />,
    )
    const bubble = openCitation("Voir les références 1, 4")
    expect(within(bubble).getByText("Source A")).toBeInTheDocument()
    expect(within(bubble).getByText("Source D")).toBeInTheDocument()
  })

  it("la bulle ne double pas le numéro qu'une référence porte déjà", () => {
    render(
      <CorrectionExplanation
        explanation="Texte [1]."
        references={["1.\nMotor Delays.\n\n2.\nAutre source."]}
      />,
    )
    fireEvent.click(screen.getByTestId("citation"))
    const bubble = screen.getByTestId("citation-popover")
    expect(within(bubble).getByRole("listitem").textContent).toBe(
      "1.\nMotor Delays.\n\n2.\nAutre source.",
    )
  })

  it("un numéro répété dans un appel n'ouvre sa référence qu'une fois", () => {
    render(
      <CorrectionExplanation explanation="Texte [3,1-3]." references={REFS} />,
    )
    const bubble = openCitation("Voir les références 1, 2, 3")
    expect(within(bubble).getAllByText("Source C")).toHaveLength(1)
  })

  it("chaque groupe d'une chaîne ouvre ses propres références", () => {
    render(
      <CorrectionExplanation
        explanation="Texte [1][3-4][5]."
        references={REFS}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Voir la référence 1" }),
    ).toHaveTextContent("[1]")
    expect(
      screen.getByRole("button", { name: "Voir la référence 5" }),
    ).toHaveTextContent("[5]")
    const bubble = openCitation("Voir les références 3, 4")
    expect(within(bubble).getByText("Source C")).toBeInTheDocument()
    expect(within(bubble).queryByText("Source A")).not.toBeInTheDocument()
    expect(within(bubble).queryByText("Source E")).not.toBeInTheDocument()
  })

  it("un appel dont un numéro dépasse la liste reste du texte simple", () => {
    const { container } = render(
      <CorrectionExplanation
        explanation="Texte [4-6] et [0] et [2]."
        references={REFS}
      />,
    )
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(container.querySelector("p")?.textContent).toBe(
      "Texte [4-6] et [0] et [2].",
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("sans référence, aucun appel n'est interactif", () => {
    const { container } = render(
      <CorrectionExplanation explanation="Texte [1][2]." references={[]} />,
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(container.querySelector("p")?.textContent).toBe("Texte [1][2].")
  })

  it("les images d'explication s'affichent sous le texte", () => {
    render(
      <CorrectionExplanation
        explanation="Texte."
        references={[]}
        images={[
          { key: "a", url: "https://cdn.test/a.png" },
          { key: "b", url: "https://cdn.test/b.png" },
        ]}
      />,
    )
    const images = screen.getByTestId("explanation-images")
    expect(within(images).getAllByRole("img")).toHaveLength(2)
  })

  it("sans image, pas de conteneur d'images", () => {
    render(<CorrectionExplanation explanation="Texte." references={[]} />)
    expect(screen.queryByTestId("explanation-images")).not.toBeInTheDocument()
  })
})

describe("CorrectionReferences", () => {
  it("numérote les références par leur position", () => {
    render(<CorrectionReferences references={["Source A", "Source B"]} />)
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent(/^1\.\s*Source A$/)
    expect(items[1]).toHaveTextContent(/^2\.\s*Source B$/)
  })

  it("ne double pas un numéro que l'entrée porte déjà", () => {
    render(
      <CorrectionReferences
        references={["1.\nMotor Delays.\n\n2.\nAutre source."]}
      />,
    )
    const item = screen.getByRole("listitem")
    expect(item.textContent).toBe("1.\nMotor Delays.\n\n2.\nAutre source.")
  })

  it("garde son numéro à une entrée dont le numéro de tête n'est pas sa position", () => {
    render(
      <CorrectionReferences references={["Source A", "9. Pharmacologic"]} />,
    )
    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent(
      /^2\.\s*9\. Pharmacologic$/,
    )
  })

  it("ne rend rien sans référence", () => {
    const { container } = render(<CorrectionReferences references={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
