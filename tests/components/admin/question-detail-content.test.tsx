import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  QuestionDetailContent,
  type QuestionFile,
} from "@/components/admin/question-detail/question-detail-content"

const NOW = Date.UTC(2026, 8, 30, 14)
const DAY = 86_400_000

const makeFile = (over: Partial<QuestionFile> = {}): QuestionFile => ({
  question: {
    id: "q1",
    question: "Énoncé de la question",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: "Option B",
    objectifCMC: "Toux",
    objectiveId: "obj-toux",
    objectiveNeedsFix: false,
    domain: "Pneumologie",
    createdAt: NOW - 30 * DAY,
    updatedAt: NOW - 30 * DAY,
    explanation: "Parce que.",
    references: ["Réf 1"],
    images: [],
    explanationImages: [],
    keyConfirmation: null,
  },
  breakdown: {
    answerCount: 28,
    successRate: 32,
    options: [
      { option: "Option A", count: 3, share: 11, isKey: false },
      { option: "Option B", count: 9, share: 32, isKey: true },
      { option: "Option C", count: 13, share: 46, isKey: false },
      { option: "Option D", count: 3, share: 11, isKey: false },
    ],
    formerWording: { count: 0, share: 0 },
    keySuspect: true,
  },
  review: { toVerify: true, confirmation: null, lapsedConfirmation: null },
  exams: [],
  formatIssues: [],
  ...over,
})

describe("QuestionDetailContent", () => {
  it("clé à vérifier : l'option la plus choisie contre la clé, et son action", () => {
    render(
      <QuestionDetailContent
        file={makeFile()}
        now={NOW}
        confirmKeyAction={<button type="button">Confirmer la clé</button>}
      />,
    )
    const alert = screen.getByTestId("key-to-verify-alert")
    expect(alert).toHaveTextContent(
      "L'option C est plus choisie que la clé B : 46 % contre 32 %, sur 28 réponses.",
    )
    expect(
      within(alert).getByRole("button", { name: "Confirmer la clé" }),
    ).toBeInTheDocument()
  })

  it("confirmation tombée : rappelée dans l'alerte", () => {
    const lapsed = {
      at: NOW - 60 * DAY,
      byName: "Admin",
      answerCount: 12,
      note: null,
    }
    render(
      <QuestionDetailContent
        file={makeFile({
          review: {
            toVerify: true,
            confirmation: null,
            lapsedConfirmation: lapsed,
          },
        })}
        now={NOW}
      />,
    )
    expect(screen.getByTestId("key-to-verify-alert")).toHaveTextContent(
      "sur 12 réponses ; 28 réponses aujourd'hui, l'écart persiste.",
    )
  })

  it("clé confirmée en vigueur : auteur, réponses et note, sans alerte", () => {
    const confirmation = {
      at: NOW - DAY,
      byName: "Samuel P.",
      answerCount: 28,
      note: "Piège classique.",
    }
    render(
      <QuestionDetailContent
        file={makeFile({
          review: { toVerify: false, confirmation, lapsedConfirmation: null },
        })}
        now={NOW}
      />,
    )
    expect(screen.queryByTestId("key-to-verify-alert")).not.toBeInTheDocument()
    expect(screen.getByTestId("key-confirmed")).toHaveTextContent(
      "par Samuel P., sur 28 réponses · À revoir quand le nombre de réponses aura doublé.",
    )
    expect(screen.getByText("Piège classique.")).toBeInTheDocument()
  })

  it("répartition : formulation antérieure et non significatif", () => {
    render(
      <QuestionDetailContent
        file={makeFile({
          breakdown: {
            answerCount: 6,
            successRate: null,
            options: [
              { option: "Option A", count: 1, share: 17, isKey: false },
              { option: "Option B", count: 3, share: 50, isKey: true },
              { option: "Option C", count: 0, share: 0, isKey: false },
              { option: "Option D", count: 0, share: 0, isKey: false },
            ],
            formerWording: { count: 2, share: 33 },
            keySuspect: false,
          },
          review: {
            toVerify: false,
            confirmation: null,
            lapsedConfirmation: null,
          },
        })}
        now={NOW}
      />,
    )
    expect(
      screen.getByText("Non significatif : 6 réponses"),
    ).toBeInTheDocument()
    expect(screen.getByTestId("answer-share-former")).toHaveTextContent(
      "Formulation antérieure",
    )
    expect(
      screen.getByText(/2 réponses portent sur un choix reformulé/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Sous 10 réponses, le taux de réussite/),
    ).toBeInTheDocument()
  })

  it("examens qui l'utilisent : 5 d'abord, liens et phase", () => {
    const exams = Array.from({ length: 7 }, (_, i) => ({
      id: `e${i}`,
      title: `Examen blanc ${7 - i}`,
      startDate: NOW - (i * 14 + 2) * DAY,
      endDate: NOW - (i * 14 - 2) * DAY,
      finalizedAt: NOW - (i * 14 + 9) * DAY,
      isActive: true,
    }))
    render(<QuestionDetailContent file={makeFile({ exams })} now={NOW} />)

    expect(screen.getAllByRole("link", { name: /Examen blanc/ })).toHaveLength(
      5,
    )
    expect(
      screen.getByRole("link", { name: /Examen blanc 7/ }),
    ).toHaveAttribute("href", "/admin/examens/e0")
    expect(screen.getByText("En cours")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher les 7 examens" }),
    )
    expect(screen.getAllByRole("link", { name: /Examen blanc/ })).toHaveLength(
      7,
    )
  })

  it("dans un aperçu, les examens ne sont pas des liens", () => {
    const exams = [
      {
        id: "e1",
        title: "Examen blanc 1",
        startDate: 0,
        endDate: DAY,
        finalizedAt: 0,
        isActive: false,
      },
    ]
    render(
      <QuestionDetailContent
        file={makeFile({ exams })}
        now={NOW}
        examLinks={false}
      />,
    )
    expect(screen.queryByRole("link", { name: /Examen blanc/ })).toBeNull()
    // Suspendu puis clos : terminé comme les autres.
    expect(screen.getByText("Terminé")).toBeInTheDocument()
  })

  it("examen en préparation sans dates : phase et fenêtre à définir", () => {
    const exams = [
      {
        id: "e1",
        title: "Examen blanc 30",
        startDate: null,
        endDate: null,
        finalizedAt: null,
        isActive: true,
      },
    ]
    render(<QuestionDetailContent file={makeFile({ exams })} now={NOW} />)
    expect(screen.getByText("En préparation")).toBeInTheDocument()
    expect(screen.getByText(/Dates à définir/)).toBeInTheDocument()
  })

  it("mise en forme à vérifier : motifs et lien vers l'édition", () => {
    render(
      <QuestionDetailContent
        file={makeFile({
          formatIssues: [
            {
              code: "lowercase-start",
              field: "explanation",
              message: "L'explication commence par une minuscule.",
            },
          ],
        })}
        now={NOW}
        editHref="/admin/questions/q1/modifier"
      />,
    )
    const alert = screen.getByTestId("format-issues-alert")
    expect(alert).toHaveTextContent("L'explication commence par une minuscule.")
    expect(
      within(alert).getByRole("link", { name: "Modifier" }),
    ).toHaveAttribute("href", "/admin/questions/q1/modifier")
  })

  it("aucun signalement tant que le canal candidat n'existe pas", () => {
    render(<QuestionDetailContent file={makeFile()} now={NOW} />)
    expect(screen.getByText("Aucun signalement")).toBeInTheDocument()
  })
})
