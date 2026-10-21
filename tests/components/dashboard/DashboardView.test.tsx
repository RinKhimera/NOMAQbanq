import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DashboardView } from "@/app/(dashboard)/tableau-de-bord/_components/dashboard-view"
import type {
  ActivityItem,
  DomainMastery,
  ExamInProgress,
  MyDashboard,
  RecentParticipation,
} from "@/features/analytics/dal"
import { DAY } from "../../helpers/time"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tableau-de-bord",
  useSearchParams: () => new URLSearchParams(),
}))
// Le contenu recharts est chargé à part : le cadre du graphique suffit ici.
vi.mock("next/dynamic", () => ({ default: () => () => null }))

const NOW = Date.parse("2026-09-27T15:00:00Z")

const emptyDashboard: MyDashboard = {
  exams: {
    averageScore: null,
    averageTrend: null,
    completedCount: 0,
    availableCount: 0,
    completedOfAvailableCount: 0,
    gradedCount: 0,
    passedCount: 0,
    periodGradedCount: 0,
    periodPassedCount: 0,
    overallAverage: null,
    history: [],
  },
  training: { sessionCount: 0, questionCount: 1, weekly: [] },
  hasHistory: true,
}

const fullDashboard: MyDashboard = {
  exams: {
    averageScore: 68,
    averageTrend: 4,
    completedCount: 5,
    availableCount: 3,
    completedOfAvailableCount: 2,
    gradedCount: 3,
    passedCount: 2,
    periodGradedCount: 2,
    periodPassedCount: 1,
    overallAverage: 64,
    history: [
      { examId: "e1", title: "Examen A", score: 58, completedAt: NOW - DAY },
      { examId: "e2", title: "Examen B", score: 70, completedAt: NOW },
    ],
  },
  training: {
    sessionCount: 3,
    questionCount: 1250,
    weekly: [
      {
        weekStart: "2026-09-21",
        startDay: "2026-09-21",
        averageScore: 62,
        sessionCount: 3,
      },
    ],
  },
  hasHistory: true,
}

const mastery: DomainMastery[] = [
  { domain: "Pédiatrie", answered: 10, mastery: 40 },
  { domain: "Cardiologie", answered: 10, mastery: 80 },
]

const participation: RecentParticipation = {
  examId: "e2",
  title: "Examen blanc de septembre",
  questionCount: 230,
  score: 70,
  completedAt: NOW,
  endDate: NOW - DAY,
}

const examInProgress: ExamInProgress = {
  examId: "e3",
  title: "Examen blanc d'octobre",
  answeredCount: 10,
  questionCount: 230,
  timing: { startedAt: NOW - 60_000, budgetSeconds: 3600, pauseCreditMs: 0 },
}

const activity: ActivityItem[] = [
  {
    kind: "series",
    id: "s1",
    domain: "Pédiatrie",
    questionCount: 20,
    score: 55,
    at: NOW,
  },
]

const renderView = (
  props: Partial<React.ComponentProps<typeof DashboardView>> = {},
) =>
  render(
    <DashboardView
      firstName="Amina"
      eyebrow="Dimanche 27 septembre"
      period="30"
      dashboard={emptyDashboard}
      access={null}
      lapsed={{ exam: null, training: null }}
      examInProgress={null}
      mastery={[]}
      participations={[]}
      percentiles={{}}
      activity={[]}
      isAdmin={false}
      now={NOW}
      {...props}
    />,
  )

const vital = (label: string) => screen.getByRole("group", { name: label })

const card = (title: string) => {
  const section = screen
    .getByRole("heading", { name: title })
    .closest("section")
  if (!section) throw new Error(`carte « ${title} » introuvable`)
  return section
}

describe("DashboardView", () => {
  it("salut et synthèse : tendance de la période et domaine le plus faible", () => {
    renderView({ dashboard: fullDashboard, mastery })
    expect(
      screen.getByRole("heading", { level: 1, name: "Bonjour Amina." }),
    ).toBeInTheDocument()
    expect(screen.getByText("Dimanche 27 septembre")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Votre score moyen a progressé de 4 points sur 30 jours. Pédiatrie reste votre domaine le plus faible.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId("quick-access-Entraînement")).toHaveAttribute(
      "href",
      "/tableau-de-bord/entrainement",
    )
    expect(screen.getByTestId("quick-access-Examens blancs")).toHaveAttribute(
      "href",
      "/tableau-de-bord/examen-blanc",
    )
  })

  it("chiffres de la période, taux de complétion arrondi à l'entier inférieur", () => {
    renderView({ dashboard: fullDashboard })
    expect(vital("Score moyen")).toHaveTextContent("68%")
    expect(vital("Examens complétés")).toHaveTextContent("5sur 3 disponibles")
    expect(vital("Entraînements")).toHaveTextContent(
      "31 250 questions pratiquées",
    )
    // 2 / 3 = 66,7 % : jamais arrondi vers le haut.
    expect(vital("Taux de complétion")).toHaveTextContent("66%")
  })

  it("courbes d'examens et de séries alimentées par l'historique", () => {
    renderView({ dashboard: fullDashboard })
    expect(
      screen.getByRole("figure", {
        name: /^Évolution du score aux examens blancs : 2 points, dernier 70 %/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("figure", {
        name: /^Score moyen des séries par semaine : 1 point, dernier 62 %/,
      }),
    ).toBeInTheDocument()
  })

  it("préparation : score global et examens réussis sur corrigés", () => {
    renderView({ dashboard: fullDashboard })
    expect(screen.getByTestId("readiness-score")).toHaveTextContent("64 %")
    expect(screen.getByTestId("readiness-passed")).toHaveTextContent("2 / 3")
    expect(screen.getByText(/examens blancs réussis\./)).toBeInTheDocument()
  })

  it("un seul examen corrigé : accord au singulier", () => {
    renderView({
      dashboard: {
        ...fullDashboard,
        exams: { ...fullDashboard.exams, gradedCount: 1, passedCount: 1 },
      },
    })
    expect(screen.getByTestId("readiness-passed")).toHaveTextContent("1 / 1")
    expect(screen.getByText(/examen blanc réussi\./)).toBeInTheDocument()
  })

  it("rien à compter : « — » partout, jamais un 0 % fabriqué", () => {
    renderView()
    expect(vital("Score moyen")).toHaveTextContent("—")
    expect(vital("Examens complétés")).toHaveTextContent(
      "aucun examen disponible",
    )
    expect(vital("Entraînements")).toHaveTextContent("1 question pratiquée")
    expect(vital("Taux de complétion")).toHaveTextContent("—")
    expect(vital("Taux de complétion")).not.toHaveTextContent("%")
    expect(
      screen.getByText("Aucun examen blanc sur la période"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Aucune série close sur la période"),
    ).toBeInTheDocument()
    expect(screen.getByTestId("readiness-score")).toHaveTextContent("—")
    expect(
      screen.getByText(/Aucun examen blanc corrigé pour l'instant\./),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("readiness-passed")).toBeNull()
  })

  it("transmet l'examen en cours, l'historique et l'activité à leurs blocs", () => {
    renderView({
      dashboard: fullDashboard,
      examInProgress,
      participations: [participation],
      activity,
    })
    expect(
      screen.getByText("Examen blanc d'octobre en cours"),
    ).toBeInTheDocument()
    expect(
      within(card("Examens récents")).getByText("Examen blanc de septembre"),
    ).toBeInTheDocument()
    expect(
      within(card("Dernières actions")).getByText("Série terminée · Pédiatrie"),
    ).toBeInTheDocument()
  })
})
