import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  type QuestionImage,
  QuestionImageGallery,
  QuestionImageIndicator,
} from "@/components/shared/question-image-gallery"

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

// Mock yet-another-react-lightbox
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

// Mock lightbox plugins
vi.mock("yet-another-react-lightbox/plugins/zoom", () => ({
  default: {},
}))

vi.mock("yet-another-react-lightbox/plugins/counter", () => ({
  default: {},
}))

// Mock CSS imports
vi.mock("yet-another-react-lightbox/styles.css", () => ({}))
vi.mock("yet-another-react-lightbox/plugins/counter.css", () => ({}))

const createMockImages = (count: number): QuestionImage[] =>
  Array.from({ length: count }, (_, i) => ({
    url: `https://example.b-cdn.net/image${i + 1}.jpg`,
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
    it("renders a single image", () => {
      const images = createMockImages(1)
      render(<QuestionImageGallery images={images} />)

      const renderedImages = screen.getAllByTestId("next-image")
      expect(renderedImages).toHaveLength(1)
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

    it("shows +N indicator when images exceed maxDisplay", () => {
      const images = createMockImages(6)
      render(<QuestionImageGallery images={images} maxDisplay={4} />)

      // Should show only 4 images
      const renderedImages = screen.getAllByTestId("next-image")
      expect(renderedImages).toHaveLength(4)

      // Should show +2 overlay
      expect(screen.getByText("+2")).toBeInTheDocument()
    })

    it("respects custom maxDisplay value", () => {
      const images = createMockImages(5)
      render(<QuestionImageGallery images={images} maxDisplay={2} />)

      const renderedImages = screen.getAllByTestId("next-image")
      expect(renderedImages).toHaveLength(2)

      expect(screen.getByText("+3")).toBeInTheDocument()
    })

    it("opens lightbox at correct index when image is clicked", () => {
      const images = createMockImages(3)
      render(<QuestionImageGallery images={images} />)

      const buttons = screen.getAllByRole("button")
      fireEvent.click(buttons[1]) // Click second image

      const lightbox = screen.getByTestId("lightbox")
      expect(lightbox).toHaveAttribute("data-index", "1")
    })
  })

  describe("size variants", () => {
    it("applies sm size class", () => {
      const images = createMockImages(1)
      const { container } = render(
        <QuestionImageGallery images={images} size="sm" />,
      )

      const button = container.querySelector("button")
      expect(button?.className).toContain("h-20")
      expect(button?.className).toContain("w-20")
    })

    it("applies md size class (default)", () => {
      const images = createMockImages(1)
      const { container } = render(<QuestionImageGallery images={images} />)

      const button = container.querySelector("button")
      expect(button?.className).toContain("h-32")
      expect(button?.className).toContain("w-32")
    })

    it("applies lg size class", () => {
      const images = createMockImages(1)
      const { container } = render(
        <QuestionImageGallery images={images} size="lg" />,
      )

      const button = container.querySelector("button")
      expect(button?.className).toContain("h-48")
      expect(button?.className).toContain("w-48")
    })
  })

  describe("image sorting", () => {
    it("sorts images by order", () => {
      const images: QuestionImage[] = [
        { url: "https://example.com/c.jpg", storagePath: "c.jpg", order: 2 },
        { url: "https://example.com/a.jpg", storagePath: "a.jpg", order: 0 },
        { url: "https://example.com/b.jpg", storagePath: "b.jpg", order: 1 },
      ]

      render(<QuestionImageGallery images={images} />)

      const renderedImages = screen.getAllByTestId("next-image")
      // Images should be rendered in order: a, b, c
      expect(renderedImages[0]).toHaveAttribute(
        "src",
        expect.stringContaining("a.jpg"),
      )
      expect(renderedImages[1]).toHaveAttribute(
        "src",
        expect.stringContaining("b.jpg"),
      )
      expect(renderedImages[2]).toHaveAttribute(
        "src",
        expect.stringContaining("c.jpg"),
      )
    })
  })

  describe("custom className", () => {
    it("applies custom className", () => {
      const images = createMockImages(1)
      const { container } = render(
        <QuestionImageGallery images={images} className="custom-class" />,
      )

      const button = container.querySelector("button")
      expect(button?.className).toContain("custom-class")
    })
  })
})

describe("QuestionImageIndicator", () => {
  it("returns null when no images", () => {
    const { container } = render(<QuestionImageIndicator images={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("returns null when images is undefined", () => {
    const { container } = render(<QuestionImageIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it("displays count for single image", () => {
    const images = createMockImages(1)
    render(<QuestionImageIndicator images={images} />)

    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("displays count for multiple images", () => {
    const images = createMockImages(5)
    render(<QuestionImageIndicator images={images} />)

    expect(screen.getByText("5")).toBeInTheDocument()
  })
})
