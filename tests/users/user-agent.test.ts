import { describe, expect, it } from "vitest"
import { describeUserAgent } from "@/features/users/lib/user-agent"

describe("describeUserAgent", () => {
  it("renvoie un libellé de repli si vide", () => {
    expect(describeUserAgent(null)).toBe("Appareil inconnu")
    expect(describeUserAgent("")).toBe("Appareil inconnu")
  })

  it("détecte Chrome sur Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    expect(describeUserAgent(ua)).toBe("Chrome · Windows")
  })

  it("détecte Edge (pas Chrome) et Safari sur macOS", () => {
    expect(describeUserAgent("... Chrome/120 Edg/120 ...")).toContain("Edge")
    const safari =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    expect(describeUserAgent(safari)).toBe("Safari · macOS")
  })

  it("détecte Firefox sur Linux et Safari sur iOS", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Firefox/120.0",
      ),
    ).toBe("Firefox · Linux")
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ... Safari/604.1",
      ),
    ).toBe("Safari · iOS")
  })
})
