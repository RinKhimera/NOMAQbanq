import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ParticipantResultsError } from "@/app/(admin)/admin/examens/[id]/resultats/[userId]/_components/participant-results-error"
import type { ExamParticipantUser } from "@/features/exams/dal"

const exam = { id: "exam-1", title: "Examen blanc 27" }
const student: ExamParticipantUser = {
  id: "user-1",
  name: "Hélène Martin",
  username: "helene",
  email: "helene@example.com",
  image: null,
}

const panel = () => screen.getByTestId("copy-unavailable")

describe("ParticipantResultsError", () => {
  it("étudiant sans participation : pas de copie", () => {
    render(
      <ParticipantResultsError
        error="NO_PARTICIPATION"
        exam={exam}
        participantUser={student}
      />,
    )

    expect(
      within(panel()).getByRole("heading", { name: "Aucune participation" }),
    ).toBeInTheDocument()
    expect(panel()).toHaveTextContent(
      "Cet étudiant n'a pas commencé cet examen : il n'a pas de copie.",
    )
    expect(
      screen.getByRole("heading", { level: 1, name: "Hélène Martin" }),
    ).toBeInTheDocument()
    expect(screen.getByText("helene@example.com")).toBeInTheDocument()
  })

  it("compte inexistant : le dit, sans courriel", () => {
    render(
      <ParticipantResultsError
        error="NO_PARTICIPATION"
        exam={exam}
        participantUser={null}
      />,
    )

    expect(panel()).toHaveTextContent(
      "Ce compte n'existe pas ou a été supprimé.",
    )
    expect(
      screen.getByRole("heading", { level: 1, name: "Compte introuvable" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/@/)).toBeNull()
  })

  it("participation non soumise : dit son statut", () => {
    render(
      <ParticipantResultsError
        error="NOT_COMPLETED"
        status="in_progress"
        exam={exam}
        participantUser={student}
      />,
    )

    expect(
      within(panel()).getByRole("heading", {
        name: "Copie pas encore soumise",
      }),
    ).toBeInTheDocument()
    expect(panel()).toHaveTextContent(
      "La participation est en cours : la copie se lit une fois soumise",
    )
  })

  it("ramène à la fiche de l'examen", () => {
    render(
      <ParticipantResultsError
        error="NOT_COMPLETED"
        exam={exam}
        participantUser={student}
      />,
    )

    expect(
      screen.getByRole("link", { name: "Retour à l'examen" }),
    ).toHaveAttribute("href", "/admin/examens/exam-1")
    expect(
      screen.getByRole("link", { name: "Examen blanc 27" }),
    ).toHaveAttribute("href", "/admin/examens/exam-1")
  })
})
