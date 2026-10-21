import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { TransactionsClient } from "@/app/(admin)/admin/transactions/_components/transactions-client"
import { NBSP } from "@/lib/format"
import {
  NOW,
  makeClientRow,
  makeClientsPage,
  makeFile,
  makeStats,
  makeTx,
} from "./fixtures"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  updateManualTransaction: vi.fn(),
  deleteManualTransaction: vi.fn(),
  loadTransactionAccessImpact: vi.fn(),
  loadClientTimeline: vi.fn(),
}))
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
  usePathname: () => "/admin/transactions",
}))
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
vi.mock("@/features/payments/actions", () => ({
  recordManualPayment: vi.fn(),
  updateManualTransaction: mocks.updateManualTransaction,
  deleteManualTransaction: mocks.deleteManualTransaction,
  loadTransactionAccessImpact: mocks.loadTransactionAccessImpact,
  loadClientTimeline: mocks.loadClientTimeline,
}))
vi.mock("@/features/exams/actions", () => ({
  loadSearchSelectableUsers: vi.fn(async () => []),
}))

type Props = ComponentProps<typeof TransactionsClient>

const props = (overrides: Partial<Props> = {}): Props => ({
  stats: makeStats(),
  clients: makeClientsPage({
    items: [makeClientRow(), makeClientRow({ userId: "u2", name: "Awa" })],
  }),
  q: "",
  filter: "all",
  clientId: null,
  file: null,
  txId: null,
  products: [],
  initialNow: NOW,
  ...overrides,
})

/** L'URL courante, que l'écran relit pour ne pas perdre la ligne dépliée. */
const at = (search: string) =>
  window.history.replaceState(null, "", `/admin/transactions${search}`)

const renderClient = (overrides: Partial<Props> = {}, search = "") => {
  at(search)
  return render(<TransactionsClient {...props(overrides)} />)
}

const manual = makeTx({ id: "tx-m", type: "manual", stripeUrl: null })
const withManualFile = {
  clientId: "u1",
  file: makeFile({ timeline: { items: [manual], nextCursor: null } }),
  txId: "tx-m",
}

describe("TransactionsClient — aucune transaction", () => {
  it("état vide ; son action ouvre la saisie d'un paiement manuel", () => {
    renderClient({ stats: makeStats({ transactionCount: 0 }) })

    expect(
      screen.getByText("Aucune transaction pour l'instant"),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("transactions-summary")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer un paiement manuel" }),
    )
    expect(
      within(screen.getByRole("dialog")).getByText(
        "Enregistrer un paiement manuel",
      ),
    ).toBeInTheDocument()
  })
})

describe("TransactionsClient — synthèse", () => {
  it("revenus CAD, acheteurs et transactions au pluriel ; XAF masqué à zéro", () => {
    renderClient()

    const summary = screen.getByTestId("transactions-summary")
    expect(summary).toHaveTextContent("3 acheteurs · 4 transactions")
    expect(summary).not.toHaveTextContent("XAF")
  })

  it("singulier, et XAF affiché dès qu'il y a un revenu", () => {
    renderClient({
      stats: makeStats({
        buyerCount: 1,
        transactionCount: 1,
        revenueByCurrency: {
          CAD: { total: 0, recent: 0 },
          XAF: { total: 25000, recent: 0 },
        },
      }),
    })

    const summary = screen.getByTestId("transactions-summary")
    expect(summary).toHaveTextContent("1 acheteur · 1 transaction")
    expect(summary.textContent).toContain(`XAF${NBSP}:`)
  })

  it("« Paiement manuel » ouvre la saisie sans client imposé", () => {
    renderClient()
    fireEvent.click(screen.getByRole("button", { name: "Paiement manuel" }))

    expect(
      within(screen.getByRole("dialog")).getByText("Choisir un utilisateur"),
    ).toBeInTheDocument()
  })
})

describe("TransactionsClient — navigation dans l'URL", () => {
  it("un filtre remplace l'URL, revient en tête de liste et garde le client ouvert", () => {
    renderClient({}, "?client=u1&tx=t9&apres=c3")
    fireEvent.click(screen.getByTestId("client-filter-failed"))

    expect(mocks.replace).toHaveBeenCalledWith(
      "/admin/transactions?client=u1&filtre=echec",
      { scroll: false },
    )
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("la recherche part après 300 ms, une seule fois", () => {
    vi.useFakeTimers()
    renderClient()
    const input = screen.getByPlaceholderText("Nom ou courriel du client")
    fireEvent.change(input, { target: { value: "aw" } })
    act(() => vi.advanceTimersByTime(100))
    fireEvent.change(input, { target: { value: "awa " } })
    act(() => vi.advanceTimersByTime(299))
    expect(mocks.replace).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
      "/admin/transactions?q=awa",
      { scroll: false },
    )
  })

  it("le terme déjà appliqué ne renavigue pas", () => {
    vi.useFakeTimers()
    renderClient({ q: "awa" }, "?q=awa")
    act(() => vi.advanceTimersByTime(1000))
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("« Effacer les filtres » vide la recherche et le filtre", () => {
    renderClient(
      { q: "zzz", filter: "dispute", clients: makeClientsPage({ items: [] }) },
      "?q=zzz&filtre=litige&client=u1",
    )
    fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }))

    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/admin/transactions?client=u1",
      { scroll: false },
    )
    expect(
      screen.getByPlaceholderText("Nom ou courriel du client"),
    ).toHaveValue("")
  })

  it("choisir un client pousse son dossier dans l'historique, sans la transaction précédente", () => {
    renderClient({}, "?q=awa&client=u1&tx=t9")
    fireEvent.click(screen.getByTestId("client-u2"))

    expect(mocks.push).toHaveBeenCalledWith(
      "/admin/transactions?q=awa&client=u2",
      { scroll: false },
    )
  })

  it("tranche suivante : curseur « après » à la place de « avant »", () => {
    renderClient(
      {
        clients: makeClientsPage({
          total: 60,
          firstIndex: 20,
          prevCursor: "p1",
          nextCursor: "n1",
        }),
      },
      "?avant=p0&filtre=echec",
    )
    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }))

    expect(mocks.replace).toHaveBeenCalledWith(
      "/admin/transactions?filtre=echec&apres=n1",
      { scroll: false },
    )
  })

  it("tranche précédente : curseur « avant »", () => {
    renderClient(
      {
        clients: makeClientsPage({
          total: 60,
          firstIndex: 20,
          prevCursor: "p1",
          nextCursor: null,
        }),
      },
      "?apres=n0",
    )
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Page précédente" }))

    expect(mocks.replace).toHaveBeenCalledWith("/admin/transactions?avant=p1", {
      scroll: false,
    })
  })

  it("sans paramètre restant, l'URL revient au chemin nu", () => {
    renderClient({ clientId: "u1", file: makeFile() }, "?client=u1&tx=tx-1")
    fireEvent.click(screen.getByRole("button", { name: "Tous les clients" }))

    expect(mocks.push).toHaveBeenCalledWith("/admin/transactions", {
      scroll: false,
    })
  })
})

describe("TransactionsClient — panneau du dossier", () => {
  it("aucun client choisi : invitation à en choisir un", () => {
    renderClient()
    expect(screen.getByText("Choisissez un client")).toBeInTheDocument()
  })

  it("client choisi sans dossier : aucun paiement tenté", () => {
    renderClient({ clientId: "u9" })
    expect(
      screen.getByText("Aucune transaction pour ce compte"),
    ).toBeInTheDocument()
  })

  it("dossier chargé : la transaction de l'URL est dépliée", () => {
    renderClient(withManualFile, "?client=u1&tx=tx-m")

    expect(
      screen.getByRole("heading", { name: "Chloé Tremblay" }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId("timeline-tx-m")).getByRole("button", {
        expanded: true,
      }),
    ).toBeInTheDocument()
  })

  it("une autre transaction du même client dans l'URL : le dossier se déplie sur elle", () => {
    const first = makeTx({ id: "tx-a" })
    const second = makeTx({ id: "tx-b" })
    const file = makeFile({
      transactionCount: 2,
      timeline: { items: [first, second], nextCursor: null },
    })
    const { rerender } = renderClient(
      { clientId: "u1", file, txId: "tx-a" },
      "?client=u1&tx=tx-a",
    )
    at("?client=u1&tx=tx-b")
    rerender(
      <TransactionsClient {...props({ clientId: "u1", file, txId: "tx-b" })} />,
    )

    expect(
      within(screen.getByTestId("timeline-tx-b")).getByRole("button", {
        expanded: true,
      }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId("timeline-tx-a")).getByRole("button", {
        expanded: false,
      }),
    ).toBeInTheDocument()
  })

  it("« Paiement pour ce client » ouvre la saisie avec ce client imposé", () => {
    renderClient(withManualFile, "?client=u1")
    fireEvent.click(
      screen.getByRole("button", { name: "Paiement pour ce client" }),
    )

    const dialog = screen.getByRole("dialog")
    expect(
      within(dialog).queryByText("Choisir un utilisateur"),
    ).not.toBeInTheDocument()
    expect(dialog).toHaveTextContent("Chloé Tremblay")
  })
})

describe("TransactionsClient — écritures sur un paiement manuel", () => {
  it("suppression confirmée : toast, rafraîchissement et fermeture", async () => {
    mocks.loadTransactionAccessImpact.mockResolvedValue([])
    mocks.deleteManualTransaction.mockResolvedValue({ success: true })
    renderClient(withManualFile, "?client=u1&tx=tx-m")

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    const dialog = await screen.findByRole("alertdialog")
    const confirm = within(dialog).getByRole("button", { name: "Supprimer" })
    await waitFor(() => expect(confirm).not.toBeDisabled())
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Paiement supprimé · accès recalculé",
      ),
    )
    expect(mocks.deleteManualTransaction).toHaveBeenCalledWith("tx-m")
    expect(mocks.refresh).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
  })

  it("une écriture repart des données fraîches : les pages plus anciennes chargées sont lâchées", async () => {
    mocks.loadClientTimeline.mockResolvedValue({
      items: [makeTx({ id: "tx-old" })],
      nextCursor: null,
    })
    mocks.loadTransactionAccessImpact.mockResolvedValue([])
    mocks.deleteManualTransaction.mockResolvedValue({ success: true })
    renderClient(
      {
        clientId: "u1",
        file: makeFile({
          transactionCount: 2,
          timeline: { items: [manual], nextCursor: "c1" },
        }),
        txId: "tx-m",
      },
      "?client=u1&tx=tx-m",
    )
    fireEvent.click(screen.getByRole("button", { name: /plus ancienne/ }))
    expect(await screen.findByTestId("timeline-tx-old")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    const dialog = await screen.findByRole("alertdialog")
    const confirm = within(dialog).getByRole("button", { name: "Supprimer" })
    await waitFor(() => expect(confirm).not.toBeDisabled())
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(screen.queryByTestId("timeline-tx-old")).not.toBeInTheDocument(),
    )
  })

  it("modification enregistrée : toast « Paiement modifié »", async () => {
    mocks.updateManualTransaction.mockResolvedValue({ success: true })
    renderClient(withManualFile, "?client=u1&tx=tx-m")

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }))

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Paiement modifié"),
    )
    expect(mocks.refresh).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
  })

  it("remboursement enregistré : toast d'accès recalculé", async () => {
    mocks.loadTransactionAccessImpact.mockResolvedValue([])
    mocks.updateManualTransaction.mockResolvedValue({ success: true })
    renderClient(withManualFile, "?client=u1&tx=tx-m")

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Remboursé" }))
    const submit = within(dialog).getByRole("button", {
      name: "Rembourser et révoquer",
    })
    await waitFor(() => expect(submit).not.toBeDisabled())
    fireEvent.click(submit)

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Paiement remboursé · accès recalculé",
      ),
    )
  })

  it("annuler la modification ferme la fenêtre sans écrire", async () => {
    renderClient(withManualFile, "?client=u1&tx=tx-m")

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
