import { render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ProfileView } from "@/components/shared/profile/profile-view"
import type { NotificationPreferences } from "@/features/notifications/dal"
import type { CurrentUser } from "@/features/users/dal"
import type { AdminActivity } from "@/features/users/dal.activity"

// Le profil compose des sections clientes qui ont leurs propres tests : seules
// les différences entre profil admin et profil candidat se prouvent ici.
vi.mock("@/components/shared/avatar-uploader", () => ({
  AvatarUploader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))
vi.mock("@/components/shared/profile/profile-account-section", () => ({
  ProfileAccountSection: () => null,
}))
vi.mock("@/components/shared/profile/profile-personal-info", () => ({
  ProfilePersonalInfo: () => null,
}))
vi.mock("@/components/shared/profile/profile-preferences", () => ({
  ProfilePreferences: () => null,
}))
vi.mock("@/components/shared/profile/profile-sessions", () => ({
  ProfileSessions: () => null,
}))
vi.mock("@/features/notifications/actions", () => ({
  updateNotificationPreferences: vi.fn(),
  updatePaymentAlertsPreference: vi.fn(),
}))
vi.mock("@/features/users/actions", () => ({ deleteMyAccount: vi.fn() }))
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }))

const prefs: NotificationPreferences = {
  examResults: true,
  accessExpiry: true,
  marketing: true,
  paymentAlerts: true,
}

const userOf = (role: "user" | "admin"): CurrentUser => ({
  id: "u1",
  name: "Sandrine Mbappé",
  email: "sandrine@test.invalid",
  image: null,
  role,
  username: null,
  bio: null,
  createdAt: new Date("2025-11-12T15:00:00Z"),
})

const activity: AdminActivity = {
  manualPayments: {
    count: 3,
    totals: [
      { currency: "CAD", amount: 8050 },
      { currency: "XAF", amount: 8_500_000 },
    ],
    lastAt: new Date("2026-10-03T15:00:00Z"),
  },
  exams: { count: 9, openOrUpcoming: 2 },
  confirmedKeys: 6,
  suspensions: { pronounced: 3, active: 1, lifted: 2 },
  feed: [
    {
      kind: "manual_payment",
      at: new Date("2026-10-03T15:00:00Z"),
      label: "Karim Haddad · Accès Examens",
      id: "tx1",
      clientId: "c1",
    },
    {
      kind: "suspension",
      at: new Date("2026-10-02T15:00:00Z"),
      label: "Lina Tremblay",
      id: "u9",
    },
  ],
}

const renderProfile = (
  role: "user" | "admin",
  adminActivity: AdminActivity | null = null,
) =>
  render(
    <ProfileView
      user={userOf(role)}
      methods={null}
      sessions={[]}
      notificationPreferences={prefs}
      adminActivity={adminActivity}
      googleEnabled={false}
      profilePath={
        role === "admin" ? "/admin/profil" : "/tableau-de-bord/profil"
      }
    />,
  )

describe("ProfileView — profil administrateur", () => {
  it("montre l'activité de l'administrateur, chiffres et dernières actions", () => {
    renderProfile("admin", activity)

    const section = screen.getByRole("region", { name: "Mon activité" })
    expect(within(section).getByText("Paiements manuels")).toBeInTheDocument()
    expect(
      within(section).getByText(/80,50 \$ · 85 000 XAF/),
    ).toBeInTheDocument()
    expect(
      within(section).getByText("dont 2 ouverts ou à venir"),
    ).toBeInTheDocument()
    expect(within(section).getByText("1 active · 2 levées")).toBeInTheDocument()
    expect(
      within(section).getByRole("link", {
        name: /Karim Haddad · Accès Examens/,
      }),
    ).toHaveAttribute("href", "/admin/transactions?client=c1&tx=tx1")
    expect(
      within(section).getByRole("link", { name: /Lina Tremblay/ }),
    ).toHaveAttribute("href", "/admin/utilisateurs/u9")
    expect(screen.getByText(/Administrateur depuis/)).toBeInTheDocument()
  })

  it("n'offre que l'interrupteur des alertes de paiement, et pas la suppression", () => {
    renderProfile("admin", activity)

    const switches = screen.getAllByRole("switch")
    expect(switches).toHaveLength(1)
    expect(switches[0]).toHaveAccessibleName("Alertes de paiement")
    expect(
      screen.queryByRole("button", { name: /Supprimer mon compte/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/contactez un autre administrateur/),
    ).toBeInTheDocument()
  })

  it("annonce un fil vide à un administrateur qui n'a encore rien fait", () => {
    renderProfile("admin", {
      manualPayments: { count: 0, totals: [], lastAt: null },
      exams: { count: 0, openOrUpcoming: 0 },
      confirmedKeys: 0,
      suspensions: { pronounced: 0, active: 0, lifted: 0 },
      feed: [],
    })

    expect(
      screen.getByText("Vos actions d'administration apparaîtront ici."),
    ).toBeInTheDocument()
  })
})

describe("ProfileView — activité indisponible", () => {
  it("garde le profil administrateur et signale l'activité manquante", () => {
    renderProfile("admin", null)

    const section = screen.getByRole("region", { name: "Mon activité" })
    expect(
      within(section).getByText("Impossible de charger votre activité"),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("switch")).toHaveLength(1)
    expect(
      screen.queryByRole("button", { name: /Supprimer mon compte/ }),
    ).not.toBeInTheDocument()
  })
})

describe("ProfileView — profil candidat", () => {
  it("reste inchangé : trois interrupteurs, suppression, pas d'activité", () => {
    renderProfile("user")

    expect(
      screen.queryByRole("region", { name: "Mon activité" }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole("switch")).toHaveLength(3)
    expect(
      screen.getByRole("button", { name: /Supprimer mon compte/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Membre depuis/)).toBeInTheDocument()
  })
})
