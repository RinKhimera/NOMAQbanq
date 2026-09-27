import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DeleteTransactionDialog } from "@/components/shared/payments/delete-transaction-dialog"
import type { Transaction } from "@/components/shared/payments/transaction-table"
import type { AccessImpact } from "@/features/payments/dal"

vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

const { loadImpact } = vi.hoisted(() => ({ loadImpact: vi.fn() }))
vi.mock("@/features/payments/actions", () => ({
  deleteManualTransaction: vi.fn(),
  loadTransactionAccessImpact: loadImpact,
}))

const DAY = 24 * 60 * 60 * 1000

const makeTransaction = (_id: string): Transaction => ({
  _id,
  type: "manual",
  status: "completed",
  amountPaid: 5000,
  currency: "CAD",
  accessType: "exam",
  durationDays: 30,
  createdAt: 1700000000000,
  product: { _id: "prod_1", name: "Pack Premium" },
  user: { _id: "user_1", name: "Jean Dupont", email: "jean@example.com" },
})

const revokesTraining: AccessImpact[] = [
  {
    accessType: "exam",
    willAffectAccess: false,
    currentAccessExpiresAt: Date.now() + 90 * DAY,
    restoredExpiresAt: Date.now() + 90 * DAY,
  },
  {
    accessType: "training",
    willAffectAccess: true,
    currentAccessExpiresAt: Date.now() + 60 * DAY,
    restoredExpiresAt: null,
  },
]

/** Promesse résolue à la main : l'aperçu arrive quand le test le décide. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const REVOKES_TRAINING =
  "La suppression révoquera l'accès à l'entraînement de l'utilisateur : aucune autre transaction ne le couvre."

describe("DeleteTransactionDialog — aperçu d'impact", () => {
  beforeEach(() => {
    loadImpact.mockReset()
  })

  it("n'affirme rien tant que l'aperçu n'est pas arrivé, et bloque la suppression", async () => {
    const pending = deferred<AccessImpact[] | null>()
    loadImpact.mockReturnValue(pending.promise)

    render(
      <DeleteTransactionDialog
        transaction={makeTransaction("tx_a")}
        open
        onOpenChange={() => {}}
      />,
    )

    expect(
      screen.getByText("Calcul de l'impact sur l'accès…"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Accès non affecté")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeDisabled()

    await act(async () => pending.resolve(revokesTraining))

    expect(screen.getByText(REVOKES_TRAINING)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeEnabled()
  })

  it("ignore l'aperçu d'une transaction qui n'est plus celle ouverte", async () => {
    const forA = deferred<AccessImpact[] | null>()
    const forB = deferred<AccessImpact[] | null>()
    loadImpact.mockImplementation((id: string) =>
      id === "tx_a" ? forA.promise : forB.promise,
    )

    const { rerender } = render(
      <DeleteTransactionDialog
        transaction={makeTransaction("tx_a")}
        open
        onOpenChange={() => {}}
      />,
    )
    rerender(
      <DeleteTransactionDialog
        transaction={makeTransaction("tx_b")}
        open
        onOpenChange={() => {}}
      />,
    )

    await act(async () => forA.resolve(revokesTraining))

    expect(screen.queryByText(REVOKES_TRAINING)).not.toBeInTheDocument()
    expect(
      screen.getByText("Calcul de l'impact sur l'accès…"),
    ).toBeInTheDocument()
  })

  it("aperçu en échec : le dit, et laisse la suppression possible", async () => {
    loadImpact.mockRejectedValue(new Error("Failed to fetch"))

    render(
      <DeleteTransactionDialog
        transaction={makeTransaction("tx_a")}
        open
        onOpenChange={() => {}}
      />,
    )

    expect(
      await screen.findByText("Impact sur l'accès indisponible"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Accès non affecté")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeEnabled()
  })
})
