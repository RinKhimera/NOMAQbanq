import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { CheckoutCancelledNotice } from "@/app/(marketing)/tarifs/_components/checkout-cancelled-notice"

describe("CheckoutCancelledNotice", () => {
  it("rassure sur l'absence de débit, sans alarmer", () => {
    render(<CheckoutCancelledNotice />)

    expect(screen.getByRole("status")).toHaveTextContent(
      "Paiement annulé : aucun montant n'a été débité.",
    )
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("se referme", async () => {
    render(<CheckoutCancelledNotice />)

    await userEvent.click(screen.getByRole("button", { name: "Fermer" }))

    expect(screen.queryByRole("status")).toBeNull()
  })
})
