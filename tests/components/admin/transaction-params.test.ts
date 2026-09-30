import { describe, expect, it } from "vitest"
import {
  listParams,
  parseClientFilter,
} from "@/app/(admin)/admin/transactions/_components/transaction-params"

describe("parseClientFilter", () => {
  it("lit le filtre de l'URL, « Tous » par défaut", () => {
    expect(parseClientFilter("litige")).toBe("dispute")
    expect(parseClientFilter("echec")).toBe("failed")
    expect(parseClientFilter(undefined)).toBe("all")
    expect(parseClientFilter("inconnu")).toBe("all")
  })
})

describe("listParams", () => {
  const page2 = new URLSearchParams("apres=abc&client=u1&tx=t1&q=nadia")

  it("changer le filtre ramène en première tranche, dossier conservé", () => {
    const next = listParams(page2, { filter: "manual" })
    expect(next.get("apres")).toBeNull()
    expect(next.get("filtre")).toBe("manuel")
    expect(next.get("client")).toBe("u1")
    expect(next.get("q")).toBe("nadia")
  })

  it("changer la recherche ramène en première tranche", () => {
    const next = listParams(new URLSearchParams("avant=xyz&filtre=echec"), {
      q: "  chloé ",
    })
    expect(next.get("avant")).toBeNull()
    expect(next.get("q")).toBe("chloé")
    expect(next.get("filtre")).toBe("echec")
  })

  it("« Tous » et une recherche vide retirent leur paramètre", () => {
    const next = listParams(new URLSearchParams("filtre=litige&q=x"), {
      filter: "all",
      q: " ",
    })
    expect(next.toString()).toBe("")
  })
})
