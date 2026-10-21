import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { ClientFile } from "@/app/(admin)/admin/transactions/_components/client-file"
import type { TransactionClientFile } from "@/features/payments/dal"
import { NOW, makeFile, makeTx } from "./fixtures"

const mocks = vi.hoisted(() => ({
  loadClientTimeline: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock("@/features/payments/actions", () => ({
  loadClientTimeline: mocks.loadClientTimeline,
}))
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))

const DAY = 24 * 60 * 60 * 1000

const props = (
  overrides: Partial<ComponentProps<typeof ClientFile>> = {},
): ComponentProps<typeof ClientFile> => ({
  file: makeFile(),
  writes: 0,
  initialNow: NOW,
  initialExpandedId: null,
  onBack: vi.fn(),
  onNewPayment: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  ...overrides,
})

const renderFile = (
  overrides: Partial<ComponentProps<typeof ClientFile>> = {},
) => {
  const p = props(overrides)
  render(<ClientFile {...p} />)
  return p
}

/** Dossier de 25 transactions dont seule la plus récente est chargée. */
const longFile: TransactionClientFile = makeFile({
  transactionCount: 25,
  timeline: { items: [makeTx({ id: "tx-1" })], nextCursor: "c1" },
})

const olderPage = {
  items: [
    makeTx({ id: "tx-2", product: { id: "p2", code: "x", name: "Ancien A" } }),
    makeTx({ id: "tx-3", product: { id: "p3", code: "x", name: "Ancien B" } }),
  ],
  nextCursor: "c2",
}

const toggleOf = (id: string) =>
  screen.getByTestId(`timeline-${id}`).querySelector("button") as HTMLElement

describe("ClientFile — en-tête", () => {
  it("nom, courriel, lien vers la fiche du compte et nouveau paiement", () => {
    const { onNewPayment } = renderFile()

    expect(
      screen.getByRole("heading", { name: "Chloé Tremblay" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Voir la fiche du compte" }),
    ).toHaveAttribute("href", "/admin/utilisateurs/u1")

    fireEvent.click(
      screen.getByRole("button", { name: "Paiement pour ce client" }),
    )
    expect(onNewPayment).toHaveBeenCalledOnce()
  })

  it("sans nom : le courriel en titre", () => {
    renderFile({
      file: makeFile({
        client: {
          id: "u1",
          name: " ",
          email: "anon@example.com",
          image: null,
          deleted: false,
        },
      }),
    })
    expect(
      screen.getByRole("heading", { name: "anon@example.com" }),
    ).toBeInTheDocument()
  })

  it("compte supprimé : plus de paiement possible, ni lien vers la fiche", () => {
    renderFile({
      file: makeFile({
        client: {
          id: "u1",
          name: "Chloé Tremblay",
          email: "chloe@example.com",
          image: null,
          deleted: true,
        },
      }),
    })

    expect(screen.getByText(/Compte supprimé/)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Paiement pour ce client" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Voir la fiche du compte" }),
    ).not.toBeInTheDocument()
  })

  it("« Tous les clients » remonte le retour à la liste", () => {
    const { onBack } = renderFile()
    fireEvent.click(screen.getByRole("button", { name: "Tous les clients" }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe("ClientFile — constat et accès", () => {
  it("le constat du dossier est affiché, bordé de rouge pour un litige", () => {
    renderFile({ file: makeFile({ verdict: { kind: "dispute" } }) })

    const verdict = screen.getByTestId("client-verdict")
    expect(verdict).toHaveTextContent(/^Litige en cours/)
    expect(verdict).toHaveClass("border-danger")
  })

  it("constat sans gravité : pas de bordure rouge", () => {
    renderFile()
    expect(screen.getByTestId("client-verdict")).not.toHaveClass(
      "border-danger",
    )
  })

  it("un accès actif rappelle comment le retirer ; un accès jamais acheté non", () => {
    renderFile({
      file: makeFile({ access: { exam: NOW + 5 * DAY, training: null } }),
    })

    expect(screen.getByText(/^Actif jusqu'au/)).toBeInTheDocument()
    expect(screen.getByText("Jamais acheté")).toBeInTheDocument()
    expect(screen.getAllByText(/Pour retirer cet accès/)).toHaveLength(1)
  })

  it("l'accès se juge à l'instant initial reçu du serveur", () => {
    renderFile({
      file: makeFile({ access: { exam: NOW - DAY, training: null } }),
    })
    expect(screen.getByText(/^Expiré le/)).toBeInTheDocument()
    expect(screen.queryByText(/Pour retirer cet accès/)).not.toBeInTheDocument()
  })

  it("accès retiré après remboursement", () => {
    renderFile({
      file: makeFile({ refunded: { exam: false, training: true } }),
    })
    expect(screen.getByText("Retiré après remboursement")).toBeInTheDocument()
  })
})

describe("ClientFile — chronologie", () => {
  it("une transaction se déplie au clic et l'URL porte son identifiant", () => {
    window.history.replaceState(null, "", "/admin/transactions?client=u1")
    renderFile()

    const toggle = toggleOf("tx-1")
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Identifiant")).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Identifiant")).toBeInTheDocument()
    expect(window.location.search).toBe("?client=u1&tx=tx-1")

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(window.location.search).toBe("?client=u1")
  })

  it("une transaction ouverte par lien est dépliée d'emblée", () => {
    renderFile({ initialExpandedId: "tx-1" })
    expect(toggleOf("tx-1")).toHaveAttribute("aria-expanded", "true")
  })

  it("le détail déplié remonte l'édition d'un paiement manuel", () => {
    const manual = makeTx({ id: "tx-m", type: "manual", stripeUrl: null })
    const { onEdit, onDelete } = renderFile({
      file: makeFile({ timeline: { items: [manual], nextCursor: null } }),
      initialExpandedId: "tx-m",
    })

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    expect(onEdit).toHaveBeenCalledWith(manual)
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    expect(onDelete).toHaveBeenCalledWith(manual)
  })

  it("produit disparu : « Produit inconnu » dans la ligne", () => {
    renderFile({
      file: makeFile({
        timeline: { items: [makeTx({ product: null })], nextCursor: null },
      }),
    })
    expect(toggleOf("tx-1")).toHaveTextContent("Produit inconnu")
  })

  it("tout est chargé : pas de bouton « plus anciennes »", () => {
    renderFile()
    expect(
      screen.queryByRole("button", { name: /plus ancienne/ }),
    ).not.toBeInTheDocument()
  })

  it("« Afficher … plus anciennes » charge la page suivante du client et l'ajoute", async () => {
    mocks.loadClientTimeline.mockResolvedValue(olderPage)
    renderFile({ file: longFile })

    expect(screen.getByText("1 sur 25")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", {
        name: "Afficher 20 transactions plus anciennes",
      }),
    )

    expect(await screen.findByTestId("timeline-tx-3")).toBeInTheDocument()
    expect(mocks.loadClientTimeline).toHaveBeenCalledWith("u1", "c1")
    expect(screen.getByTestId("timeline-tx-2")).toHaveTextContent("Ancien A")
    expect(screen.getByText("3 sur 25")).toBeInTheDocument()

    // Le spinner remplace l'icône tant que la transition n'est pas close : le
    // nom du bouton ne revient qu'à sa fin.
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Afficher 20 transactions plus anciennes",
      }),
    )
    await waitFor(() =>
      expect(mocks.loadClientTimeline).toHaveBeenLastCalledWith("u1", "c2"),
    )
  })

  it("le dernier lot annonce le reste exact, au singulier", () => {
    renderFile({
      file: makeFile({
        transactionCount: 2,
        timeline: { items: [makeTx()], nextCursor: "c1" },
      }),
    })
    expect(
      screen.getByRole("button", {
        name: "Afficher 1 transaction plus ancienne",
      }),
    ).toBeInTheDocument()
  })

  it("échec du chargement : toast d'erreur, rien d'ajouté", async () => {
    mocks.loadClientTimeline.mockRejectedValue(new Error("réseau"))
    renderFile({ file: longFile })

    fireEvent.click(screen.getByRole("button", { name: /plus anciennes/ }))

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Chargement impossible. Vérifiez votre réseau.",
      ),
    )
    expect(screen.getByText("1 sur 25")).toBeInTheDocument()
  })

  it("une écriture depuis la page fait repartir la chronologie des données fraîches", async () => {
    mocks.loadClientTimeline.mockResolvedValue(olderPage)
    const p = props({ file: longFile })
    const { rerender } = render(<ClientFile {...p} />)
    fireEvent.click(screen.getByRole("button", { name: /plus anciennes/ }))
    await screen.findByTestId("timeline-tx-3")

    rerender(<ClientFile {...p} />)
    expect(screen.getByTestId("timeline-tx-3")).toBeInTheDocument()

    rerender(<ClientFile {...p} writes={1} />)
    expect(screen.queryByTestId("timeline-tx-3")).not.toBeInTheDocument()
    expect(screen.getByText("1 sur 25")).toBeInTheDocument()
  })
})
