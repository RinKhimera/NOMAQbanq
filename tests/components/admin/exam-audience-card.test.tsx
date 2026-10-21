import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import {
  RestrictedAudienceCard,
  SubscribersAudienceCard,
} from "@/app/(admin)/admin/examens/[id]/_components/exam-audience-card"
import type { ExamAudienceUser } from "@/features/exams/dal"

const EDIT_HREF = "/admin/examens/modifier/exam-1#audience"

const audience: ExamAudienceUser[] = [
  { id: "u1", name: "Hélène Martin", email: "helene@example.com" },
  { id: "u2", name: "Paul Durand", email: "pdurand@example.com" },
  { id: "u3", name: "Amine Kaci", email: "zorro@example.com" },
]

const shownIds = () =>
  screen
    .queryAllByTestId(/^audience-member-/)
    .map((el) => el.dataset.testid?.replace("audience-member-", ""))

describe("RestrictedAudienceCard", () => {
  it("liste toute l'audience et mène à son édition", () => {
    render(<RestrictedAudienceCard audience={audience} editHref={EDIT_HREF} />)

    expect(shownIds()).toEqual(["u1", "u2", "u3"])
    expect(screen.getByTestId("btn-edit-audience")).toHaveAttribute(
      "href",
      EDIT_HREF,
    )
  })

  it("la recherche filtre par nom ou courriel, et dit quand rien ne correspond", async () => {
    const user = userEvent.setup()
    render(<RestrictedAudienceCard audience={audience} editHref={EDIT_HREF} />)
    const search = screen.getByTestId("audience-search")

    await user.type(search, "helene")
    expect(shownIds()).toEqual(["u1"])

    await user.clear(search)
    await user.type(search, "zorro")
    expect(shownIds()).toEqual(["u3"])

    await user.type(search, "xyz")
    expect(shownIds()).toEqual([])
    expect(
      screen.getByText("Aucun étudiant de la liste ne correspond."),
    ).toBeInTheDocument()
  })

  it("liste vide : personne ne peut passer l'examen, pas de recherche", () => {
    render(<RestrictedAudienceCard audience={[]} editHref={EDIT_HREF} />)

    expect(
      screen.getByText("Liste vide : personne ne peut passer cet examen."),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("audience-search")).toBeNull()
  })
})

describe("SubscribersAudienceCard", () => {
  it("annonce les abonnés éligibles et mène à l'édition", () => {
    render(<SubscribersAudienceCard eligible={118} editHref={EDIT_HREF} />)

    expect(screen.getByTestId("subscribers-audience-card")).toHaveTextContent(
      "118 aujourd'hui.",
    )
    expect(screen.getByTestId("btn-edit-audience")).toHaveAttribute(
      "href",
      EDIT_HREF,
    )
  })
})
