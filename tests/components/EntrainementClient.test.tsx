import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EntrainementClient } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/entrainement-client"
import type {
  ActiveTrainingSession,
  TrainingHistoryPage,
} from "@/features/training/dal"

// Chaque enfant a son propre test : ici, seules les props transmises comptent.
const { cardProps, formProps, historyProps } = vi.hoisted(() => ({
  cardProps: vi.fn(),
  formProps: vi.fn(),
  historyProps: vi.fn(),
}))

vi.mock(
  "@/app/(dashboard)/tableau-de-bord/entrainement/_components/active-series-card",
  () => ({
    ActiveSeriesCard: (props: unknown) => {
      cardProps(props)
      return <div data-testid="active-series-card" />
    },
  }),
)
vi.mock(
  "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-config-form",
  () => ({
    TrainingConfigForm: (props: unknown) => {
      formProps(props)
      return null
    },
  }),
)
vi.mock(
  "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section",
  () => ({
    TrainingHistorySection: (props: unknown) => {
      historyProps(props)
      return null
    },
  }),
)

const NOW = Date.parse("2026-09-29T15:00:00Z")

const series = {
  id: "s1",
  questionCount: 20,
  answeredCount: 12,
  mode: "tutor" as const,
  domain: "Pédiatrie",
  startedAt: NOW - 60_000,
  expiresAt: NOW + 60_000,
}

const history: TrainingHistoryPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
}

const objectifs = [{ id: "o1", objectif: "Fièvre", count: 4 }]

const renderClient = (activeSession: ActiveTrainingSession) =>
  render(
    <EntrainementClient
      activeSession={activeSession}
      domains={{
        domains: [{ domain: "Pédiatrie", count: 120 }],
        totalQuestions: 3000,
      }}
      initialDomain="Pédiatrie"
      initialRevision="failed"
      initialObjectifs={objectifs}
      initialHistory={history}
      initialNow={NOW}
    />,
  )

describe("EntrainementClient", () => {
  it("sans série en cours : pas de carte, formulaire libre, props de l'URL transmises", () => {
    renderClient(null)
    expect(screen.queryByTestId("active-series-card")).toBeNull()
    expect(formProps.mock.lastCall?.[0]).toEqual({
      domains: [{ domain: "Pédiatrie", count: 120 }],
      totalQuestions: 3000,
      initialDomain: "Pédiatrie",
      initialRevision: "failed",
      initialObjectifs: objectifs,
      hasActiveSeries: false,
    })
    expect(historyProps.mock.lastCall?.[0]).toEqual({ initialHistory: history })
  })

  it("série en cours : carte ancrée sur l'horloge serveur, formulaire bloqué", () => {
    renderClient({
      session: series,
      isExpired: false,
      canResume: true,
      remainingTimeMs: 60_000,
    })
    expect(screen.getByTestId("active-series-card")).toBeInTheDocument()
    expect(cardProps.mock.lastCall?.[0]).toEqual({
      session: series,
      initialNow: NOW,
      expired: false,
    })
    expect(formProps.mock.lastCall?.[0]).toMatchObject({
      hasActiveSeries: true,
    })
  })

  it("série expirée : la carte reste affichée, le formulaire ne bloque pas", () => {
    renderClient({
      session: series,
      isExpired: true,
      canResume: false,
      remainingTimeMs: 0,
    })
    expect(screen.getByTestId("active-series-card")).toBeInTheDocument()
    expect(cardProps.mock.lastCall?.[0]).toMatchObject({ expired: true })
    expect(formProps.mock.lastCall?.[0]).toMatchObject({
      hasActiveSeries: false,
    })
  })
})
