import { describe, expect, it } from "vitest"

import { createId } from "@/lib/ids"

describe("createId", () => {
  it("returns a v4 UUID", () => {
    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it("returns a unique value on each call", () => {
    expect(createId()).not.toBe(createId())
  })
})
