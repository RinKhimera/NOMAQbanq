import { describe, expect, it } from "vitest"
import { clientFileHref } from "@/lib/admin-links"

describe("clientFileHref", () => {
  it("dossier d'un client, transaction dépliée", () => {
    expect(clientFileHref("u1")).toBe("/admin/transactions?client=u1")
    expect(clientFileHref("u1", "t9")).toBe(
      "/admin/transactions?client=u1&tx=t9",
    )
  })
})
