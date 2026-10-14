import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { StudentShell } from "@/components/shared/shell/student-shell"
import type { ShellAccess } from "@/features/payments/dal"
import { authClient } from "@/lib/auth-client"
import type { SessionUser } from "@/lib/session-user"

const push = vi.fn()

// Le vrai Link ne laisse aucune trace de `prefetch` dans le DOM : le stub
// l'expose pour vérifier `prefetch={false}`.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: {
    children: ReactNode
    href: string
    prefetch?: boolean
  }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ push }),
}))
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn() }),
}))
// Sans `useSession` : la coquille ne doit lire la session que par ses props.
vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn(async () => ({})) },
}))
vi.mock("@/components/shared/link-pending-indicator", () => ({
  LinkPendingIndicator: () => <span data-testid="pending-indicator" />,
}))

const student: SessionUser = {
  name: "Awa Diallo",
  email: "awa@example.test",
  image: null,
  role: "user",
}

const DAY = 24 * 60 * 60 * 1000
// 20 septembre 2026, midi à Toronto.
const SEPT_20 = Date.UTC(2026, 8, 20, 16)

const noAccess: ShellAccess = { exam: null, training: null }

const renderShell = (
  pathname: string,
  user = student,
  access: ShellAccess = noAccess,
) => {
  vi.mocked(usePathname).mockReturnValue(pathname)
  return render(
    <StudentShell user={user} access={access}>
      <p>Contenu de la page</p>
    </StudentShell>,
  )
}

const studentNav = () =>
  screen.getByRole("navigation", { name: "Navigation de l'espace étudiant" })

describe("StudentShell", () => {
  it("liste les liens de l'espace étudiant, sans page encore absente", () => {
    renderShell("/tableau-de-bord")

    const links = within(studentNav()).getAllByRole("link")
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Tableau de bord", "/tableau-de-bord"],
      ["Progression", "/tableau-de-bord/progression"],
      ["Entraînement", "/tableau-de-bord/entrainement"],
      ["Examens blancs", "/tableau-de-bord/examen-blanc"],
      ["Abonnements", "/tableau-de-bord/abonnements"],
      ["Profil", "/tableau-de-bord/profil"],
    ])
  })

  it("marque la section d'une sous-page comme page courante", () => {
    renderShell("/tableau-de-bord/examen-blanc/ex_1/resultats")

    const current = within(studentNav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
    expect(current.map((l) => l.textContent)).toEqual(["Examens blancs"])
  })

  it("désactive le prefetch de chaque lien de navigation et y rend l'indicateur", () => {
    renderShell("/tableau-de-bord")

    const aside = studentNav().closest("aside")!
    for (const link of within(aside).getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false")
      expect(within(link).getByTestId("pending-indicator")).toBeInTheDocument()
    }
  })

  it("titre la barre du haut d'après l'URL, sans second h1", () => {
    renderShell("/tableau-de-bord/entrainement/s_1")

    expect(
      within(screen.getByRole("banner")).getByText("Entraînement"),
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })

  it("n'offre le lien vers l'administration qu'à un admin", () => {
    const { unmount } = renderShell("/tableau-de-bord")
    expect(
      screen.queryByRole("link", { name: "Voir l'administration" }),
    ).toBeNull()
    unmount()

    renderShell("/tableau-de-bord", { ...student, role: "admin" })
    expect(
      screen.getByRole("link", { name: "Voir l'administration" }),
    ).toHaveAttribute("href", "/admin")
  })

  describe("accès", () => {
    const accessList = () => screen.getByRole("list", { name: "Vos accès" })

    it.each([
      [
        "actif",
        { expiresAt: SEPT_20 + 42 * DAY, daysRemaining: 42 },
        "42 j restants",
        "success",
      ],
      [
        "expire bientôt",
        { expiresAt: SEPT_20 + DAY, daysRemaining: 1 },
        "1 j restant",
        "warning",
      ],
      [
        "expiré",
        { expiresAt: SEPT_20, daysRemaining: 0 },
        "Expiré le 20 sept.",
        "danger",
      ],
      ["aucun", null, "Non actif", "neutral"],
    ] as const)("%s : libellé et tonalité", (_, exam, label, tone) => {
      renderShell("/tableau-de-bord", student, { exam, training: null })

      const line = within(accessList()).getByRole("link", { name: /Examens/ })
      const state = within(line).getByTestId("access-state")
      expect(state.textContent).toBe(label)
      expect(state).toHaveAttribute("data-tone", tone)
    })

    it("liste Examens puis Entraînement, chaque ligne vers les Abonnements, sans prefetch", () => {
      renderShell("/tableau-de-bord", student, {
        exam: null,
        training: { expiresAt: SEPT_20 + 9 * DAY, daysRemaining: 9 },
      })

      const links = within(accessList()).getAllByRole("link")
      expect(links.map((l) => l.textContent)).toEqual([
        expect.stringMatching(/^ExamensNon actif/),
        expect.stringMatching(/^Entraînement9 j restants/),
      ])
      for (const link of links) {
        expect(link).toHaveAttribute("href", "/tableau-de-bord/abonnements")
        expect(link).toHaveAttribute("data-prefetch", "false")
      }
    })

    it("masque le bloc pour un admin", () => {
      renderShell("/tableau-de-bord", { ...student, role: "admin" })
      expect(screen.queryByRole("list", { name: "Vos accès" })).toBeNull()
    })

    it("apparaît aussi dans le menu sous 1024 px", async () => {
      renderShell("/tableau-de-bord")
      await userEvent.click(
        screen.getByRole("button", { name: "Ouvrir le menu" }),
      )
      expect(
        within(screen.getByRole("dialog")).getByRole("list", {
          name: "Vos accès",
        }),
      ).toBeInTheDocument()
    })
  })

  it("déconnecte puis renvoie à la connexion", async () => {
    renderShell("/tableau-de-bord")

    await userEvent.click(
      screen.getByRole("button", { name: "Se déconnecter" }),
    )

    expect(authClient.signOut).toHaveBeenCalledOnce()
    expect(push).toHaveBeenCalledWith("/connexion")
  })

  describe("menu sous 1024 px", () => {
    it("ouvre la navigation dans un panneau", async () => {
      renderShell("/tableau-de-bord")

      await userEvent.click(
        screen.getByRole("button", { name: "Ouvrir le menu" }),
      )

      const sheet = screen.getByRole("dialog")
      expect(
        within(sheet).getByRole("link", { name: "Abonnements" }),
      ).toBeInTheDocument()
    })

    it("se referme sur la page courante, où aucune navigation ne suivra", async () => {
      renderShell("/tableau-de-bord/profil")
      await userEvent.click(
        screen.getByRole("button", { name: "Ouvrir le menu" }),
      )

      await userEvent.click(
        within(screen.getByRole("dialog")).getByRole("link", {
          name: "Profil",
        }),
      )

      expect(screen.queryByRole("dialog")).toBeNull()
    })

    it("se referme sur une ligne d'accès cliquée depuis les Abonnements", async () => {
      renderShell("/tableau-de-bord/abonnements")
      await userEvent.click(
        screen.getByRole("button", { name: "Ouvrir le menu" }),
      )

      const access = within(screen.getByRole("dialog")).getByRole("list", {
        name: "Vos accès",
      })
      await userEvent.click(
        within(access).getByRole("link", { name: /Examens/ }),
      )

      expect(screen.queryByRole("dialog")).toBeNull()
    })

    it("se referme quand l'URL change, et ne se rouvre pas au retour", async () => {
      const { rerender } = renderShell("/tableau-de-bord")
      const navigateTo = (pathname: string) => {
        vi.mocked(usePathname).mockReturnValue(pathname)
        rerender(
          <StudentShell user={student} access={noAccess}>
            <p>Contenu de la page</p>
          </StudentShell>,
        )
      }
      await userEvent.click(
        screen.getByRole("button", { name: "Ouvrir le menu" }),
      )
      expect(screen.getByRole("dialog")).toBeInTheDocument()

      navigateTo("/tableau-de-bord/abonnements")
      expect(screen.queryByRole("dialog")).toBeNull()

      // Bouton Précédent : le layout reste monté entre les deux pages.
      navigateTo("/tableau-de-bord")
      expect(screen.queryByRole("dialog")).toBeNull()
    })

    it("rend le focus au bouton du menu à la fermeture", async () => {
      renderShell("/tableau-de-bord")
      const trigger = screen.getByRole("button", { name: "Ouvrir le menu" })
      await userEvent.click(trigger)

      await userEvent.keyboard("{Escape}")

      expect(screen.queryByRole("dialog")).toBeNull()
      expect(trigger).toHaveFocus()
    })
  })
})
