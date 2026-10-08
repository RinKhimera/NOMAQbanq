import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  type QuestionImage,
  QuestionImageGallery,
} from "@/components/shared/question-image-gallery"

// Le vrai `Image` réécrit `src` en `/_next/image?url=…` : le stub expose l'URL
// que le composant lui confie.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

vi.mock("yet-another-react-lightbox", () => ({
  default: ({
    open,
    close,
    index,
  }: {
    open: boolean
    close: () => void
    index: number
  }) =>
    open ? (
      <div data-testid="lightbox" data-index={index}>
        <button onClick={close} data-testid="lightbox-close">
          Close
        </button>
      </div>
    ) : null,
}))

vi.mock("yet-another-react-lightbox/plugins/zoom", () => ({
  default: {},
}))

vi.mock("yet-another-react-lightbox/plugins/counter", () => ({
  default: {},
}))

vi.mock("yet-another-react-lightbox/styles.css", () => ({}))
vi.mock("yet-another-react-lightbox/plugins/counter.css", () => ({}))

const createMockImages = (count: number): QuestionImage[] =>
  Array.from({ length: count }, (_, i) => ({
    url: `https://cdn.nomaqbanq.ca/questions/q1/image${i + 1}.jpg`,
    storagePath: `questions/q1/image${i + 1}.jpg`,
    order: i,
  }))

describe("QuestionImageGallery", () => {
  describe("empty state", () => {
    it("returns null when images array is empty", () => {
      const { container } = render(<QuestionImageGallery images={[]} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe("single image display", () => {
    it("sert l'URL telle quelle (aucune transformation CDN)", () => {
      const images = createMockImages(1)
      render(<QuestionImageGallery images={images} />)
      const img = screen.getByTestId("next-image")
      expect(img).toHaveAttribute("src", images[0].url)
      expect(img.getAttribute("src")).not.toContain("?width=")
    })

    it("opens lightbox when single image is clicked", () => {
      const images = createMockImages(1)
      render(<QuestionImageGallery images={images} />)

      // Initially lightbox should not be visible
      expect(screen.queryByTestId("lightbox")).not.toBeInTheDocument()

      // Click the image button
      const button = screen.getByRole("button")
      fireEvent.click(button)

      // Lightbox should now be visible
      expect(screen.getByTestId("lightbox")).toBeInTheDocument()
    })

    it("closes lightbox when close is triggered", () => {
      const images = createMockImages(1)
      render(<QuestionImageGallery images={images} />)

      // Open lightbox
      fireEvent.click(screen.getByRole("button"))
      expect(screen.getByTestId("lightbox")).toBeInTheDocument()

      // Close lightbox
      fireEvent.click(screen.getByTestId("lightbox-close"))
      expect(screen.queryByTestId("lightbox")).not.toBeInTheDocument()
    })
  })

  describe("multiple images grid", () => {
    it("renders all images when count is within maxDisplay", () => {
      const images = createMockImages(3)
      render(<QuestionImageGallery images={images} />)

      const renderedImages = screen.getAllByTestId("next-image")
      expect(renderedImages).toHaveLength(3)
    })

    it.each([
      { count: 6, maxDisplay: 4, rest: "+2" },
      { count: 5, maxDisplay: 2, rest: "+3" },
    ])(
      "$count images, maxDisplay $maxDisplay : n'en montre que $maxDisplay, et « $rest » sur la dernière",
      ({ count, maxDisplay, rest }) => {
        render(
          <QuestionImageGallery
            images={createMockImages(count)}
            maxDisplay={maxDisplay}
          />,
        )

        expect(screen.getAllByTestId("next-image")).toHaveLength(maxDisplay)
        expect(screen.getAllByRole("button")[maxDisplay - 1]).toHaveTextContent(
          rest,
        )
      },
    )

    it("opens lightbox at correct index when image is clicked", () => {
      const images = createMockImages(3)
      render(<QuestionImageGallery images={images} />)

      const buttons = screen.getAllByRole("button")
      fireEvent.click(buttons[1]) // Click second image

      const lightbox = screen.getByTestId("lightbox")
      expect(lightbox).toHaveAttribute("data-index", "1")
    })
  })

  it.each([
    { size: "sm", classes: ["h-20", "w-20"] },
    { size: undefined, classes: ["h-32", "w-32"] },
    { size: "lg", classes: ["h-48", "w-48"] },
  ] as const)(
    "image seule, taille $size : dimensions du palier et className de l'appelant",
    ({ size, classes }) => {
      render(
        <QuestionImageGallery
          images={createMockImages(1)}
          size={size}
          className="custom-class"
        />,
      )

      expect(screen.getByRole("button")).toHaveClass(...classes, "custom-class")
    },
  )

  it("trie les images par ordre", () => {
    const images: QuestionImage[] = [
      { url: "https://example.com/c.jpg", storagePath: "c.jpg", order: 2 },
      { url: "https://example.com/a.jpg", storagePath: "a.jpg", order: 0 },
      { url: "https://example.com/b.jpg", storagePath: "b.jpg", order: 1 },
    ]

    render(<QuestionImageGallery images={images} />)

    expect(
      screen.getAllByTestId("next-image").map((img) => img.getAttribute("src")),
    ).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
      "https://example.com/c.jpg",
    ])
  })
})
