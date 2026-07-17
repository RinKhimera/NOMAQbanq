import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  csvQuote,
  downloadBlob,
  downloadCsv,
  exportRowsToXlsx,
  timestampedFilename,
} from "@/lib/export"

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({}) as Record<string, unknown>),
    book_new: vi.fn(() => ({ Sheets: {}, SheetNames: [] })),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

const { utils, writeFile } = await import("xlsx")

describe("csvQuote", () => {
  it("entoure de guillemets et double les guillemets internes", () => {
    expect(csvQuote("simple")).toBe('"simple"')
    expect(csvQuote('dit "bonjour"')).toBe('"dit ""bonjour"""')
    expect(csvQuote("")).toBe('""')
  })
})

describe("timestampedFilename", () => {
  it("suffixe la date ISO courte", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-03-15T12:00:00Z"))
    try {
      expect(timestampedFilename("questions-export", "csv")).toBe(
        "questions-export-2024-03-15.csv",
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("downloadBlob / downloadCsv", () => {
  let capturedBlob: Blob | null
  const original = {
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL,
  }

  beforeEach(() => {
    capturedBlob = null
    // On patche les deux méthodes SANS remplacer le constructeur URL global
    // (happy-dom s'en sert ailleurs).
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob
      return "blob:fake-url"
    }) as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    URL.createObjectURL = original.create
    URL.revokeObjectURL = original.revoke
  })

  it("downloadBlob crée un lien, clique et libère l'URL", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click")
    downloadBlob(new Blob(["contenu"]), "fichier.txt")

    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url")
  })

  it("downloadCsv préfixe le BOM UTF-8 et joint les lignes par \\n", async () => {
    downloadCsv(['"a";"b"', '"1";"2"'], "export.csv")

    expect(capturedBlob).not.toBeNull()
    expect(capturedBlob!.type).toBe("text/csv;charset=utf-8;")
    const text = await capturedBlob!.text()
    expect(text).toBe('﻿"a";"b"\n"1";"2"')
  })
})

describe("exportRowsToXlsx", () => {
  it("construit la feuille, applique les largeurs et écrit le fichier", () => {
    const rows = [{ Nom: "Ada", Score: 92 }]
    exportRowsToXlsx(rows, {
      sheetName: "Utilisateurs",
      filename: "u.xlsx",
      colWidths: [25, 10],
    })

    expect(utils.json_to_sheet).toHaveBeenCalledWith(rows)
    const sheet = vi.mocked(utils.json_to_sheet).mock.results.at(-1)!
      .value as Record<string, unknown>
    expect(sheet["!cols"]).toEqual([{ wch: 25 }, { wch: 10 }])
    expect(utils.book_append_sheet).toHaveBeenCalledWith(
      expect.anything(),
      sheet,
      "Utilisateurs",
    )
    expect(writeFile).toHaveBeenCalledWith(expect.anything(), "u.xlsx")
  })

  it("fonctionne sans colWidths (pas de !cols posé)", () => {
    exportRowsToXlsx([{ A: 1 }], { sheetName: "S", filename: "s.xlsx" })
    const sheet = vi.mocked(utils.json_to_sheet).mock.results.at(-1)!
      .value as Record<string, unknown>
    expect(sheet["!cols"]).toBeUndefined()
  })
})
