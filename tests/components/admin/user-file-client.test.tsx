import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserFileClient } from "@/app/(admin)/admin/utilisateurs/[id]/_components/user-file-client"
import type { ProductView } from "@/features/payments/dal"
import type { UserFile, UserFileParticipation } from "@/features/users/dal"

const mocks = vi.hoisted(() => ({
  recordManualPayment: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/features/payments/actions", () => ({
  recordManualPayment: mocks.recordManualPayment,
}))
vi.mock("@/features/users/actions", () => ({
  updateUserRole: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
}))
vi.mock("@/features/exams/actions", () => ({
  loadSearchSelectableUsers: vi.fn(async () => []),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}))

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 21, 15)

const products: ProductView[] = [
  {
    id: "p1",
    code: "exam_access",
    name: "Accès Examens · 1 mois",
    description: "",
    priceCAD: 5000,
    durationDays: 30,
    accessType: "exam",
    isCombo: false,
  },
]

const participation = (
  id: string,
  overrides: Partial<UserFileParticipation> = {},
): UserFileParticipation => ({
  id,
  examId: `exam-${id}`,
  examTitle: `Examen ${id}`,
  status: "completed",
  score: 80,
  examEndsAt: NOW - DAY,
  at: NOW - 2 * DAY,
  ...overrides,
})

const baseFile: UserFile = {
  user: {
    id: "u-1",
    name: "Awa Diallo",
    username: "awad",
    email: "awa@exemple.com",
    image: null,
    bio: null,
    role: "user",
    banned: false,
    createdAt: NOW - 100 * DAY,
    lastLoginAt: NOW - DAY,
    imported: false,
    loginMethods: ["credential"],
  },
  access: { exam: null, training: null },
  refunded: { exam: false, training: false },
  accessPaidBy: { exam: null, training: null },
  payments: null,
  activity: {
    lastActivity: null,
    participations: [],
    participationCount: 0,
    series: null,
    bookmarkCount: 0,
  },
  communications: {
    prefs: { examResults: true, accessExpiry: false, marketing: false },
    sent: { welcome: null, inactivity: null, cart: null, expiry: null },
  },
}

type Props = ComponentProps<typeof UserFileClient>

const renderFile = (
  file: Partial<UserFile> = {},
  props: Partial<Omit<Props, "file">> = {},
) =>
  render(
    <UserFileClient
      file={{ ...baseFile, ...file }}
      bans={[]}
      products={products}
      currentUserId="admin-1"
      initialNow={NOW}
      {...props}
    />,
  )

const withUser = (user: Partial<UserFile["user"]>) => ({
  user: { ...baseFile.user, ...user },
})

beforeEach(() => {
  mocks.recordManualPayment.mockResolvedValue({ success: true })
})

describe("UserFileClient — en-tête", () => {
  it("nom, nom d'utilisateur, courriel et rôle ; pas de « (vous) » pour un autre compte", () => {
    renderFile()

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent(/^Awa Diallo$/)
    expect(screen.getByText("@awad")).toBeInTheDocument()
    expect(screen.getByText("awa@exemple.com")).toBeInTheDocument()
    expect(
      within(heading.parentElement as HTMLElement).getByText("Étudiant"),
    ).toBeInTheDocument()
  })

  it("sa propre fiche : « (vous) » ; compte sans nom : « Non défini » en italique", () => {
    renderFile(withUser({ name: "  ", username: null }), {
      currentUserId: "u-1",
    })

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Non défini(vous)")
    expect(heading).toHaveClass("italic")
    expect(screen.getByText("sans nom d'utilisateur")).toBeInTheDocument()
  })
})

describe("UserFileClient — accès", () => {
  it("administrateur : accès illimité, ni lignes d'accès ni octroi", () => {
    renderFile(withUser({ role: "admin" }))

    expect(
      screen.getByText("Accès illimité (administrateur)"),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("access-exam")).not.toBeInTheDocument()
    expect(screen.queryByTestId("grant-access")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Voir la progression" }),
    ).not.toBeInTheDocument()
  })

  it("jamais eu, retiré après remboursement, expiré", () => {
    const { unmount } = renderFile({
      refunded: { exam: false, training: true },
    })
    expect(screen.getByTestId("access-exam")).toHaveTextContent("Jamais eu")
    expect(screen.getByTestId("access-training")).toHaveTextContent(
      "Retiré après remboursement",
    )
    unmount()

    renderFile({ access: { exam: NOW - DAY, training: null } })
    expect(screen.getByTestId("access-exam")).toHaveTextContent(/Expiré le /)
  })

  it("actif : jours restants, renvoi vers Stripe pour un accès payé par Stripe", () => {
    renderFile({
      access: { exam: NOW + 20 * DAY, training: NOW + 3 * DAY },
      accessPaidBy: { exam: "stripe", training: "manual" },
    })

    const exam = screen.getByTestId("access-exam")
    expect(exam).toHaveTextContent(/Actif jusqu'au .+ · 20\sj restants/)
    expect(exam).toHaveTextContent(
      "payé par Stripe : remboursement dans Stripe",
    )
    expect(exam.querySelector(".text-success-ink")).not.toBeNull()

    const training = screen.getByTestId("access-training")
    expect(training).not.toHaveTextContent("payé par Stripe")
    expect(training.querySelector(".text-warning-ink")).not.toBeNull()
  })

  it("« Accorder ou prolonger » ouvre la saisie au nom du compte et enregistre pour lui", async () => {
    renderFile()
    fireEvent.click(screen.getByTestId("grant-access"))

    const dialog = screen.getByRole("dialog", {
      name: "Enregistrer un paiement manuel",
    })
    expect(within(dialog).getByText("Awa Diallo")).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("combobox", { name: "Client" }),
    ).not.toBeInTheDocument()

    mocks.recordManualPayment.mockResolvedValue({
      success: false,
      error: "Produit introuvable.",
    })
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Enregistrer et accorder l'accès",
      }),
    )

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Produit introuvable."),
    )
    expect(mocks.recordManualPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        productCode: "exam_access",
        amountPaid: 5000,
      }),
    )
  })

  it("compte sans nom : la saisie le désigne par son courriel", () => {
    renderFile(withUser({ name: " " }))
    fireEvent.click(screen.getByTestId("grant-access"))

    const dialog = screen.getByRole("dialog", {
      name: "Enregistrer un paiement manuel",
    })
    expect(within(dialog).getByText("awa@exemple.com")).toBeInTheDocument()
  })
})

describe("UserFileClient — paiements", () => {
  it("jamais tenté de payer : pas de dossier à ouvrir", () => {
    renderFile()

    expect(
      screen.getByText("Ce compte n'a jamais tenté de payer."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Aucun paiement" }),
    ).toBeDisabled()
  })

  it("résumé : dernier paiement, totaux CAD et XAF, lien vers le dossier", () => {
    renderFile({
      payments: {
        count: 4,
        totalCad: 12000,
        totalXaf: 5_000_000,
        last: {
          createdAt: NOW - DAY,
          productName: null,
          amountPaid: 5000,
          currency: "CAD",
          status: "completed",
          disputeStatus: null,
        },
      },
    })

    expect(screen.getByText(/Produit inconnu/)).toBeInTheDocument()
    expect(screen.getByText(/120\s\$ · 50\s000\sXAF/)).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Voir le dossier de paiement" }),
    ).toHaveAttribute("href", "/admin/transactions?client=u-1")
  })
})

describe("UserFileClient — activité pédagogique", () => {
  it("aucune activité : ni participations ni séries", () => {
    renderFile()

    expect(
      screen.getByText("Aucune activité depuis l'inscription."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Examens blancs ·/)).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Voir la progression" }),
    ).toHaveAttribute("href", "/admin/progression/u-1")
  })

  it("participations : score brut au plancher, « — » en cours, retenue jusqu'à la fermeture", () => {
    renderFile({
      activity: {
        ...baseFile.activity,
        lastActivity: { kind: "participation", label: "Examen a", at: NOW },
        participations: [
          participation("a", { score: 72.9, examEndsAt: NOW + DAY }),
          participation("b", { status: "in_progress", examEndsAt: NOW + DAY }),
          participation("c", { status: "auto_submitted" }),
        ],
        participationCount: 3,
      },
    })

    const held = screen.getByTestId("participation-a")
    expect(held).toHaveTextContent(/72\s%/)
    expect(held).toHaveTextContent("Non publié à l'étudiant avant le")

    const running = screen.getByTestId("participation-b")
    expect(running).toHaveTextContent("En cours")
    expect(running).toHaveTextContent("—")
    expect(running).not.toHaveTextContent("Non publié")

    const published = screen.getByTestId("participation-c")
    expect(published).toHaveTextContent("Soumis automatiquement")
    expect(published).not.toHaveTextContent("Non publié")

    expect(
      screen.getByText("Examens blancs · 3 participations"),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Voir tout/ }),
    ).not.toBeInTheDocument()
  })

  it("plus de trois participations : « Voir tout » déplie, « Réduire » replie", () => {
    renderFile({
      activity: {
        ...baseFile.activity,
        participations: ["a", "b", "c", "d"].map((id) => participation(id)),
        participationCount: 4,
      },
    })

    expect(screen.queryByTestId("participation-d")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Voir tout (4)" }))
    expect(screen.getByTestId("participation-d")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Réduire" }))
    expect(screen.queryByTestId("participation-d")).not.toBeInTheDocument()
  })

  it("séries : nombre, moyenne et part tuteur / test", () => {
    renderFile({
      activity: {
        ...baseFile.activity,
        series: { count: 7, lastAt: NOW - DAY, average: 64, tutorShare: 30 },
        bookmarkCount: 5,
      },
    })

    expect(screen.getByText("Aucune participation.")).toBeInTheDocument()
    expect(
      screen.getByText("Séries d'entraînement").parentElement,
    ).toHaveTextContent(
      /^Séries d'entraînement7dernière le .+ · moyenne 64\s% · tuteur 30\s% \/ test 70\s%$/,
    )
  })
})

describe("UserFileClient — compte et communications", () => {
  it("compte importé : connexion et bienvenue expliquées, sans dernière connexion", () => {
    renderFile(withUser({ imported: true, lastLoginAt: null }))

    expect(
      screen.getByText(/Compte importé, jamais connecté depuis la migration/),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Avant la migration, non repris"),
    ).toBeInTheDocument()
  })

  it("compte natif : méthodes de connexion, bienvenue « Non envoyé », biographie absente", () => {
    renderFile()

    expect(screen.getByText("Mot de passe")).toBeInTheDocument()
    expect(
      screen.queryByText("Avant la migration, non repris"),
    ).not.toBeInTheDocument()
    expect(screen.getAllByText("Non envoyé")).toHaveLength(4)
    expect(screen.getByText("Aucune")).toBeInTheDocument()
  })

  it("dernière connexion remplie d'office : signalée comme telle", () => {
    renderFile(withUser({ lastLoginAt: Date.UTC(2026, 8, 6, 16) }))

    expect(
      screen.getByText("Valeur remplie d'office pour tous les comptes"),
    ).toBeInTheDocument()
  })

  it("rôle et suspension : sections montées pour ce compte", () => {
    renderFile()

    expect(
      screen.getByRole("button", { name: "Promouvoir administrateur" }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("ban-open")).toBeInTheDocument()
  })
})
