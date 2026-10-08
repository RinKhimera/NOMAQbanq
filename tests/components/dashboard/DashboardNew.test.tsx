import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  DashboardNew,
  accessOffer,
} from "@/app/(dashboard)/tableau-de-bord/_components/dashboard-new"
import type { ProductView } from "@/features/payments/dal"

const product = (p: Partial<ProductView>): ProductView => ({
  id: p.code ?? "x",
  code: "exam_access",
  name: "Accès",
  description: "",
  priceCAD: 5000,
  durationDays: 30,
  accessType: "exam",
  isCombo: false,
  ...p,
})

const catalog = [
  product({ code: "exam_access", priceCAD: 5000 }),
  product({ code: "training_access", accessType: "training", priceCAD: 5000 }),
  product({ code: "exam_access_promo", durationDays: 180, priceCAD: 20000 }),
  product({
    code: "premium_access",
    isCombo: true,
    durationDays: 180,
    priceCAD: 35000,
  }),
]

describe("accessOffer", () => {
  it("prix mensuel le plus bas et Pack Premium, lus dans le catalogue", () => {
    expect(accessOffer(catalog)).toBe(
      "Examens ou Entraînement dès 50 $ pour 1 mois, ou le Pack Premium : les deux pendant 6 mois pour 350 $.",
    )
  })

  it("un prix modifié en base suit", () => {
    expect(accessOffer([product({ priceCAD: 4500 })])).toBe(
      "Examens ou Entraînement dès 45 $ pour 1 mois.",
    )
  })

  it("catalogue vide : une phrase sans montant", () => {
    expect(accessOffer([])).toBe(
      "Choisissez un accès Examens, Entraînement ou le Pack Premium.",
    )
  })
})

describe("DashboardNew", () => {
  it("trois étapes numérotées, la dernière verrouillée, chiffres à « — »", () => {
    render(<DashboardNew firstName="Amina" products={catalog} />)
    expect(
      screen.getByRole("heading", { level: 1, name: "Bonjour Amina." }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    expect(
      screen.getByRole("button", { name: "Nouvelle série" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("link", { name: "Voir les tarifs" }),
    ).toHaveAttribute("href", "/tarifs")
    expect(screen.getAllByText("—")).toHaveLength(2)
  })
})
