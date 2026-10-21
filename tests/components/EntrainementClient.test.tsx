import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EntrainementClient } from "@/app/(dashboard)/tableau-de-bord/entrainement/_components/entrainement-client"
import type {
  ActiveTrainingSession,
  TrainingHistoryPage,
} from "@/features/training/dal"

// Chaque enfant a son propre test : ici, seules les props transmises comptent.
const received = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock(
  "@/app/(dashboard)/tableau-de-bord/entrainement/_components/active-series-card",
  () => ({
    ActiveSeriesCard: (props: unknown) => {
      received.card = props
      return <div data-testid="active-series-card" />
    },
  }),
)
vi.mock(
  "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-config-form",
  () => ({
    TrainingConfigForm: (props: unknown) => {
      received.form = props
      return null
    },
  }),
)
vi.mock(
  "@/app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section",
  () => ({
    TrainingHistorySection: (props: unknown) => {
      received.history = props
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
    expect(received.form).toEqual({
      domains: [{ domain: "Pédiatrie", count: 120 }],
      totalQuestions: 3000,
      initialDomain: "Pédiatrie",
      initialRevision: "failed",
      initialObjectifs: objectifs,
      hasActiveSeries: false,
    })
    expect(received.history).toEqual({ initialHistory: history })
  })

  it("série en cours : carte ancrée sur l'horloge serveur, formulaire bloqué", () => {
    renderClient({
      session: series,
      isExpired: false,
      canResume: true,
      remainingTimeMs: 60_000,
    })
    expect(screen.getByTestId("active-series-card")).toBeInTheDocument()
    expect(received.card).toEqual({
      session: series,
      initialNow: NOW,
      expired: false,
    })
    expect(received.form).toMatchObject({ hasActiveSeries: true })
  })

  it("série expirée : la carte reste affichée, le formulaire ne bloque pas", () => {
    renderClient({
      session: series,
      isExpired: true,
      canResume: false,
      remainingTimeMs: 0,
    })
    expect(screen.getByTestId("active-series-card")).toBeInTheDocument()
    expect(received.card).toMatchObject({ expired: true })
    expect(received.form).toMatchObject({ hasActiveSeries: false })
  })
})
