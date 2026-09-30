import { describe, expect, it, vi } from "vitest"
import {
  csvCell,
  describeFilters,
  exportRow,
} from "@/app/(admin)/admin/utilisateurs/_components/export-users-dialog"
import { DEFAULT_USER_LIST } from "@/app/(admin)/admin/utilisateurs/_components/user-params"

// Action serveur : son module tire la base, hors de portée d'un test de rendu.
vi.mock("@/features/users/actions", () => ({ loadUsersForExport: vi.fn() }))

describe("csvCell", () => {
  it("neutralise une formule saisie par un étudiant", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvCell("+33")).toBe("'+33")
    expect(csvCell("@moi")).toBe("'@moi")
  })

  it("entoure une valeur qui casserait la ligne", () => {
    expect(csvCell("a;b")).toBe('"a;b"')
    expect(csvCell("deux\nlignes")).toBe('"deux\nlignes"')
    expect(csvCell("Nadia")).toBe("Nadia")
  })
})

describe("describeFilters", () => {
  it("résume segment, rôle, suspendus, période et recherche", () => {
    expect(
      describeFilters({
        ...DEFAULT_USER_LIST,
        segment: "never",
        role: "user",
        suspended: true,
        period: "30",
        q: "nadia",
      }),
    ).toEqual([
      "jamais eu d'accès",
      "étudiants",
      "suspendus",
      "période d'inscription",
      "« nadia »",
    ])
    expect(describeFilters(DEFAULT_USER_LIST)).toEqual([])
  })
})

describe("exportRow", () => {
  it("colonnes d'accès vides pour un accès jamais eu", () => {
    const row = exportRow({
      name: "Nadia",
      username: null,
      email: "n@x.test",
      role: "user",
      createdAt: Date.UTC(2026, 8, 1, 16),
      examExpiresAt: Date.UTC(2026, 9, 1, 16),
      trainingExpiresAt: null,
      banned: false,
    })
    expect(row["Accès Examens (expire le)"]).toBe("1 oct. 2026")
    expect(row["Accès Entraînement (expire le)"]).toBe("")
    expect(row.Suspendu).toBe("Non")
    expect(row.Rôle).toBe("Étudiant")
  })
})
