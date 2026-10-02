import { describe, expect, it } from "vitest"
import { foldForSearch } from "@/lib/search"

describe("foldForSearch", () => {
  it("ignore casse, accents et espaces superflus", () => {
    expect(foldForSearch("  Aiguë   Pédiatrie ")).toBe("aigue pediatrie")
    expect(foldForSearch("ÉCHOGRAPHIE")).toBe(foldForSearch("echographie"))
  })
})
