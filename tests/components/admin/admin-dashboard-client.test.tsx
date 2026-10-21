import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { AdminDashboardClient } from "@/app/(admin)/admin/_components/admin-dashboard-client"
import type { ProductView } from "@/features/payments/dal"

vi.mock("@/features/payments/actions", () => ({
  recordManualPayment: vi.fn(),
}))
vi.mock("@/features/exams/actions", () => ({
  loadSearchSelectableUsers: vi.fn(async () => []),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const NOW = Date.UTC(2026, 8, 27, 15, 2)

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

type Props = ComponentProps<typeof AdminDashboardClient>

const domain = (name: string, count: number) => ({ domain: name, count })

const baseProps: Props = {
  adminStats: {
    totalUsers: 1234,
    adminCount: 2,
    regularUserCount: 1232,
    totalExams: 12,
    activeExams: 3,
    totalParticipations: 0,
  },
  questionStats: {
    totalCount: 3000,
    domainStats: [
      domain("Cardiologie", 300),
      domain("Pédiatrie", 900),
      domain("Psychiatrie", 200),
      domain("Chirurgie", 800),
      domain("Obstétrique", 100),
      domain("Néphrologie", 700),
      domain("Dermatologie", 50),
      domain("Neurologie", 600),
      domain("Urologie", 5),
    ],
  },
  transactionStats: {
    revenueByCurrency: {
      CAD: { total: 0, recent: 123400 },
      XAF: { total: 0, recent: 0 },
    },
    buyerCount: 0,
    transactionCount: 0,
  },
  revenueByDay: { CAD: [], XAF: [] },
  expiringAccess: [],
  recentActivity: [],
  dashboardTrends: {
    usersTrend: 12,
    revenueByCurrency: { CAD: { recent: 0, previous: 0, trend: 0 } },
    recentUsersCount: 0,
  },
  failedClientsCount: 0,
  products,
  initialNow: NOW,
}

const renderDashboard = (overrides: Partial<Props> = {}) =>
  render(<AdminDashboardClient {...baseProps} {...overrides} />)

/** La cellule de la bande de chiffres qui porte ce libellé. */
const stat = (label: string) => {
  const cell = screen.getByText(label, { selector: "dt" }).parentElement
  if (!cell) throw new Error(`cellule « ${label} » introuvable`)
  return cell
}

describe("AdminDashboardClient", () => {
  it("bandeau daté de l'horloge serveur, pas de l'horloge locale", () => {
    renderDashboard()
    expect(screen.getByText("dimanche 27 septembre 2026")).toBeInTheDocument()
  })

  it("bande de chiffres : revenus CAD, utilisateurs, examens, accès expirant", () => {
    renderDashboard({
      expiringAccess: [
        {
          id: "a1",
          userId: "u1",
          accessType: "exam",
          expiresAt: NOW,
          daysRemaining: 2,
          user: { name: "Awa", email: "awa@exemple.com" },
        },
      ],
    })

    expect(stat("Revenus 30 jours")).toHaveTextContent(/1\s234\s\$/)
    expect(stat("Revenus 30 jours")).toHaveTextContent("stable sur 30 jours")
    expect(stat("Utilisateurs")).toHaveTextContent(/1\s234/)
    expect(stat("Utilisateurs")).toHaveTextContent(/\+12\s%\ssur 30 jours/)
    expect(stat("Examens actifs")).toHaveTextContent("3")
    expect(stat("Examens actifs")).toHaveTextContent("12 examens au total")
    expect(stat("Accès expirant")).toHaveTextContent("1")
  })

  it("revenus XAF du mois : affichés à part, à la place de la tendance", () => {
    renderDashboard({
      transactionStats: {
        ...baseProps.transactionStats,
        revenueByCurrency: {
          CAD: { total: 0, recent: 123400 },
          XAF: { total: 0, recent: 5_000_000 },
        },
      },
    })

    expect(stat("Revenus 30 jours")).toHaveTextContent(/XAF : 50\s000/)
    expect(stat("Revenus 30 jours")).not.toHaveTextContent("sur 30 jours")
    expect(screen.getByText(/XAF à part : 50\s000/)).toBeInTheDocument()
  })

  it("questions par domaine : les 8 plus fournis, du plus grand au plus petit", () => {
    renderDashboard()

    const bars = within(
      screen.getByRole("list", { name: "Les 8 domaines les plus fournis" }),
    ).getAllByRole("listitem")
    expect(bars.map((b) => b.textContent?.replace(/\d|\s/g, ""))).toEqual([
      "Pédiatrie",
      "Chirurgie",
      "Néphrologie",
      "Neurologie",
      "Cardiologie",
      "Psychiatrie",
      "Obstétrique",
      "Dermatologie",
    ])
    expect(
      screen.getByRole("link", { name: "Voir les 9 domaines" }),
    ).toHaveAttribute("href", "/admin/questions")
  })

  it.each([
    ["l'en-tête", 0],
    ["les actions rapides", 1],
  ])(
    "« Enregistrer un paiement » depuis %s ouvre la saisie, sans client imposé",
    (_, index) => {
      renderDashboard()
      expect(
        screen.queryByRole("dialog", {
          name: "Enregistrer un paiement manuel",
        }),
      ).not.toBeInTheDocument()

      fireEvent.click(
        screen.getAllByRole("button", { name: "Enregistrer un paiement" })[
          index
        ],
      )

      const dialog = screen.getByRole("dialog", {
        name: "Enregistrer un paiement manuel",
      })
      expect(within(dialog).getByLabelText("Montant")).toHaveValue("50")
      expect(
        within(dialog).getByRole("combobox", { name: "Client" }),
      ).toBeInTheDocument()

      fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }))
      expect(
        screen.queryByRole("dialog", {
          name: "Enregistrer un paiement manuel",
        }),
      ).not.toBeInTheDocument()
    },
  )
})
