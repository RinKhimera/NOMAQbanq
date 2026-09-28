import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ExamForm,
  type ExamFormSource,
} from "@/app/(admin)/admin/examens/_components/exam-form"
import type { ExamWithQuestions } from "@/features/exams/dal"
import type { SelectableUser } from "@/features/users/dal"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/features/exams/actions", () => ({
  createExam: vi.fn(),
  updateExam: vi.fn(),
}))

vi.mock("@/components/admin/question-browser", () => ({
  QuestionBrowser: ({ selectedIds }: { selectedIds: string[] }) => (
    <ol aria-label="Questions sélectionnées">
      {selectedIds.map((id) => (
        <li key={id}>{id}</li>
      ))}
    </ol>
  ),
  QuestionSelectModal: () => null,
}))

vi.mock("@/components/admin/user-multi-select", () => ({
  UserMultiSelect: ({ value }: { value: SelectableUser[] }) => (
    <ul aria-label="Utilisateurs autorisés">
      {value.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  ),
}))

const sourceExam: ExamFormSource["exam"] = {
  title: "Révision 3 (Cardiologie)",
  description: "Épreuve de cardiologie",
  endDate: Date.parse("2026-03-08T00:00:00Z"),
  enablePause: true,
  pauseDurationMinutes: 25,
  questionCount: 3,
  audienceType: "restricted",
}

const audience: SelectableUser[] = [
  { id: "u1", name: "Alice Dupont", email: "alice@test.invalid" },
  { id: "u2", name: "Bob Martin", email: "bob@test.invalid" },
]

const renderReopening = (exam = sourceExam) =>
  render(
    <ExamForm
      mode="create"
      candidates={[]}
      examOptions={[]}
      source={{ exam, questionIds: ["q3", "q1", "q2"], audience }}
    />,
  )

/** Ouvre le calendrier de la période et renvoie le bouton d'un jour. */
const dayButton = (name: RegExp) => {
  fireEvent.click(screen.getByLabelText("Période de disponibilité"))
  return screen.getAllByRole("button", { name })[0]
}

describe("ExamForm — création pré-remplie depuis un examen source", () => {
  it("suffixe le titre de « (réouverture) » et reprend la description", () => {
    renderReopening()

    expect(screen.getByLabelText("Titre de l'examen")).toHaveValue(
      "Révision 3 (Cardiologie) (réouverture)",
    )
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      "Épreuve de cardiologie",
    )
  })

  it("reprend les questions de la source dans leur ordre, et leur nombre", () => {
    renderReopening()

    const items = screen
      .getByRole("list", { name: "Questions sélectionnées" })
      .querySelectorAll("li")
    expect([...items].map((li) => li.textContent)).toEqual(["q3", "q1", "q2"])
    expect(screen.getByLabelText("Nombre de questions")).toHaveValue(3)
  })

  it("reprend le réglage de pause et sa durée", () => {
    renderReopening()

    expect(screen.getByRole("switch")).toBeChecked()
    expect(screen.getByText("25 min")).toBeInTheDocument()
  })

  it("reprend le type et la liste d'audience", () => {
    renderReopening()

    expect(
      screen.getByRole("radio", { name: /Utilisateurs spécifiques/ }),
    ).toBeChecked()
    const users = screen
      .getByRole("list", { name: "Utilisateurs autorisés" })
      .querySelectorAll("li")
    expect([...users].map((li) => li.textContent)).toEqual([
      "Alice Dupont",
      "Bob Martin",
    ])
  })

  it("n'empile pas le suffixe quand la source est elle-même une réouverture", () => {
    renderReopening({
      ...sourceExam,
      title: "Révision 3 (Cardiologie) (réouverture)",
    })

    expect(screen.getByLabelText("Titre de l'examen")).toHaveValue(
      "Révision 3 (Cardiologie) (réouverture)",
    )
  })

  it("laisse les dates vides et garde les libellés de la création", () => {
    renderReopening()

    expect(screen.getByLabelText("Période de disponibilité")).toHaveTextContent(
      "Sélectionner",
    )
    expect(
      screen.getByRole("heading", { name: "Créer un examen" }),
    ).toBeInTheDocument()
  })
})

describe("ExamForm — modification", () => {
  const exam: NonNullable<ExamWithQuestions>["exam"] = {
    ...sourceExam,
    id: "e1",
    startDate: Date.parse("2026-03-01T12:00:00"),
    endDate: Date.parse("2026-03-08T12:00:00"),
    completionTime: 3 * 83,
    isActive: true,
  }

  const renderEdit = () =>
    render(
      <ExamForm
        mode="edit"
        examId="e1"
        exam={exam}
        questionIds={["q3", "q1", "q2"]}
        candidates={[]}
        initialAudience={audience}
      />,
    )

  it("reprend l'examen tel quel : titre sans suffixe, dates, questions, libellés de modification", () => {
    renderEdit()

    expect(screen.getByLabelText("Titre de l'examen")).toHaveValue(
      "Révision 3 (Cardiologie)",
    )
    expect(screen.getByLabelText("Période de disponibilité")).toHaveTextContent(
      "1 mars 2026 - 8 mars 2026",
    )
    expect(screen.getByLabelText("Nombre de questions")).toHaveValue(3)
    const items = screen
      .getByRole("list", { name: "Questions sélectionnées" })
      .querySelectorAll("li")
    expect([...items].map((li) => li.textContent)).toEqual(["q3", "q1", "q2"])
    expect(
      screen.getByRole("heading", { name: "Modifier l'examen" }),
    ).toBeInTheDocument()
  })

  it("laisse choisir une date passée, pour corriger la fin d'un examen clos", () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-28T12:00:00"))
    renderEdit()

    expect(dayButton(/September 1st, 2026/)).toBeEnabled()
  })
})

describe("ExamForm — création", () => {
  it("n'offre pas de date passée", () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-28T12:00:00"))
    renderReopening()

    expect(dayButton(/September 1st, 2026/)).toBeDisabled()
  })
})

afterEach(() => {
  vi.useRealTimers()
})
