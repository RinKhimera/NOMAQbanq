import { render, screen } from "@testing-library/react"
import { ComponentPropsWithoutRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { UserAvatar } from "@/components/shared/user-avatar"
import { CDN_HOST } from "@/lib/cdn"

// Radix AvatarImage ne rend l'<img> qu'après l'événement `load` (jamais émis en
// happy-dom) → on stubbe les primitives pour tester la résolution d'URL.
vi.mock("@radix-ui/react-avatar", () => ({
  Root: ({ children, ...props }: ComponentPropsWithoutRef<"span">) => (
    <span {...props}>{children}</span>
  ),
  Image: ({ src, alt }: { src?: string; alt?: string }) =>
    src ? <img src={src} alt={alt} data-testid="avatar-img" /> : null,
  Fallback: ({ children, ...props }: ComponentPropsWithoutRef<"span">) => (
    <span data-testid="avatar-fallback" {...props}>
      {children}
    </span>
  ),
}))

// NB : les initiales viennent de `getInitials` (`lib/utils.ts`), helper
// canonique déjà couvert par tests/lib/utils.test.ts — pas re-testé ici.

describe("UserAvatar", () => {
  it("résout une clé S3 brute en URL CDN", () => {
    render(<UserAvatar name="Jean Dupont" image="avatars/u1/1.jpg" />)
    expect(screen.getByTestId("avatar-img")).toHaveAttribute(
      "src",
      `https://${CDN_HOST}/avatars/u1/1.jpg`,
    )
  })

  it("laisse passer une URL absolue (Google) telle quelle", () => {
    const url = "https://lh3.googleusercontent.com/a/photo.jpg"
    render(<UserAvatar name="Jean" image={url} />)
    expect(screen.getByTestId("avatar-img")).toHaveAttribute("src", url)
  })

  it("laisse passer un data: URI tel quel", () => {
    const data = "data:image/png;base64,AAAA"
    render(<UserAvatar name="Jean" image={data} />)
    expect(screen.getByTestId("avatar-img")).toHaveAttribute("src", data)
  })

  it("sans image : pas d'<img>, initiales en fallback", () => {
    render(<UserAvatar name="Jean Dupont" image={null} />)
    expect(screen.queryByTestId("avatar-img")).not.toBeInTheDocument()
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD")
  })
})
