import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ExamRankingView } from "@/app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/_components/exam-ranking-view"
import type { ExamRanking, ExamRankingRow } from "@/features/exams/dal"

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void

/**
 * Observateur factice : le test décide quand la ligne du lecteur sort de
 * l'écran. `next/link` observe aussi ses liens : seul compte l'observateur
 * posé sur la ligne du lecteur.
 */
const stubObserver = () => {
  const box: { notify: ObserverCallback } = { notify: () => {} }
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: ObserverCallback) {}
      observe(el: Element) {
        if (el.querySelector('[data-testid="ranking-self"]'))
          box.notify = this.callback
      }
      unobserve() {}
      disconnect() {}
    },
  )
  return box
}

const row = (rank: number, over: Partial<ExamRankingRow> = {}) => ({
  rank,
  username: `cand_${rank}`,
  image: null,
  score: 100 - rank,
  isSelf: false,
  ...over,
})

const ranking = (over: Partial<ExamRanking> = {}): ExamRanking => ({
  exam: {
    id: "ex-25",
    title: "Examen blanc 25",
    endDate: Date.parse("2026-09-21T04:00:00Z"),
    questionCount: 230,
  },
  total: 3,
  rows: [row(1), row(2, { isSelf: true }), row(3)],
  mine: { held: false, rank: 2, score: 98 },
  hasOwnCopy: true,
  correctionLocked: false,
  ...over,
})

const longRanking = (n: number, selfRank: number): ExamRanking => ({
  ...ranking(),
  total: n,
  rows: Array.from({ length: n }, (_, i) =>
    row(i + 1, { score: 90, isSelf: i + 1 === selfRank }),
  ),
  mine: { held: false, rank: selfRank, score: 90 },
})

describe("ExamRankingView", () => {
  it("rend l'en-tête, ma position, mon percentile et « Voir mes réponses » vers la correction", () => {
    stubObserver()
    render(<ExamRankingView ranking={ranking()} percentile={87} />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Examen blanc 25" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/230\squestions · 3\sparticipants/)).toBeVisible()
    expect(screen.getByTestId("ranking-mine-rank")).toHaveTextContent(
      "Rang 2 sur 3",
    )
    expect(screen.getByTestId("ranking-percentile")).toHaveTextContent(
      "Vous avez fait mieux que 87 % des autres participants",
    )
    expect(
      screen.getByRole("link", { name: /Voir mes réponses/ }),
    ).toHaveAttribute("href", "/tableau-de-bord/examen-blanc/ex-25/resultats")
  })

  it("n'affiche pas de percentile quand il n'est pas disponible", () => {
    stubObserver()
    render(<ExamRankingView ranking={ranking()} percentile={null} />)

    expect(screen.queryByTestId("ranking-percentile")).not.toBeInTheDocument()
  })

  it("ne met aucune action sur les lignes des autres candidats", () => {
    stubObserver()
    render(<ExamRankingView ranking={ranking()} percentile={null} />)

    const list = screen.getByRole("list", {
      name: "Classement des participants",
    })
    expect(within(list).queryAllByRole("link")).toEqual([])
    expect(within(list).queryAllByRole("button")).toEqual([])
    expect(within(list).getAllByTestId("ranking-row")).toHaveLength(2)
    expect(within(list).getByTestId("ranking-self")).toHaveTextContent("Vous")
  })

  it("affiche « Candidat anonyme » pour un candidat sans nom d'utilisateur", () => {
    stubObserver()
    render(
      <ExamRankingView
        ranking={ranking({
          rows: [row(1, { username: null }), row(2, { isSelf: true })],
        })}
        percentile={null}
      />,
    )

    expect(screen.getByText("Candidat anonyme")).toBeInTheDocument()
  })

  it("mon score retenu : ni rang ni score, la correction reste ouverte", () => {
    stubObserver()
    render(
      <ExamRankingView
        ranking={ranking({
          rows: [row(1), row(2)],
          total: 2,
          mine: { held: true, withheldBy: "Examen blanc 27" },
        })}
        percentile={null}
      />,
    )

    const mine = screen.getByTestId("ranking-mine")
    expect(mine).toHaveTextContent(
      "Score retenu, publié à la fermeture de Examen blanc 27.",
    )
    expect(screen.queryByTestId("ranking-mine-rank")).not.toBeInTheDocument()
    expect(
      within(mine).getByRole("link", { name: /Voir mes réponses/ }),
    ).toHaveAttribute("href", "/tableau-de-bord/examen-blanc/ex-25/resultats")
    expect(mine).toHaveTextContent(
      "Les questions communes avec Examen blanc 27 seront corrigées à sa fermeture.",
    )
  })

  it("sans accès Examens : classement visible, correction verrouillée avec un lien vers les tarifs", () => {
    stubObserver()
    render(
      <ExamRankingView
        ranking={ranking({ correctionLocked: true })}
        percentile={null}
      />,
    )

    expect(
      screen.getByRole("button", { name: /Voir mes réponses/ }),
    ).toBeDisabled()
    expect(
      screen.queryByRole("link", { name: /Voir mes réponses/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Voir les tarifs" }),
    ).toHaveAttribute("href", "/tarifs")
    expect(screen.getAllByTestId("ranking-row")).toHaveLength(2)
  })

  it("admin sans participation : ni bloc « Votre position » ni « Voir mes réponses »", () => {
    stubObserver()
    render(
      <ExamRankingView
        ranking={ranking({
          rows: [row(1), row(2)],
          total: 2,
          mine: null,
          hasOwnCopy: false,
        })}
        percentile={null}
      />,
    )

    expect(screen.queryByTestId("ranking-mine")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /Voir mes réponses/ }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByTestId("ranking-row")).toHaveLength(2)
  })

  it("admin qui a passé l'examen : non classé, mais « Voir mes réponses » mène à sa copie", () => {
    stubObserver()
    render(
      <ExamRankingView
        ranking={ranking({ rows: [row(1), row(2)], total: 2, mine: null })}
        percentile={null}
      />,
    )

    expect(screen.queryByTestId("ranking-mine")).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Voir mes réponses/ }),
    ).toHaveAttribute("href", "/tableau-de-bord/examen-blanc/ex-25/resultats")
  })

  it("signale les rangs omis entre la fin de la liste et ma ligne", () => {
    stubObserver()
    render(
      <ExamRankingView
        ranking={ranking({
          total: 600,
          rows: [row(1), row(2), row(600, { score: 10, isSelf: true })],
          mine: { held: false, rank: 600, score: 10 },
        })}
        percentile={null}
      />,
    )

    expect(screen.getByTestId("ranking-gap")).toHaveAccessibleName(
      "Rangs 3 à 599 non affichés",
    )
  })

  it("« Aller à ma position » n'apparaît qu'au-delà de 12 participants", () => {
    stubObserver()
    const { rerender } = render(
      <ExamRankingView ranking={longRanking(12, 5)} percentile={null} />,
    )
    expect(
      screen.queryByRole("button", { name: "Aller à ma position" }),
    ).not.toBeInTheDocument()

    rerender(<ExamRankingView ranking={longRanking(13, 5)} percentile={null} />)
    expect(
      screen.getByRole("button", { name: "Aller à ma position" }),
    ).toBeInTheDocument()
  })

  it("épingle ma ligne en haut ou en bas quand elle sort de l'écran, et y ramène", async () => {
    const observer = stubObserver()
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {})
    render(<ExamRankingView ranking={longRanking(40, 20)} percentile={null} />)
    expect(screen.getAllByTestId("ranking-self")).toHaveLength(1)

    act(() =>
      observer.notify([
        {
          isIntersecting: false,
          boundingClientRect: { top: -200 } as DOMRect,
          rootBounds: { top: 64 } as DOMRect,
        },
      ]),
    )
    expect(screen.getAllByTestId("ranking-self")).toHaveLength(1)
    const pinned = screen.getByTestId("ranking-self-pinned")
    expect(
      within(pinned).getByText("cand_20").closest('[aria-hidden="true"]'),
    ).not.toBeNull()
    expect(
      screen.getAllByRole("button", { name: "Aller à ma position" }),
    ).toHaveLength(2)

    act(() =>
      observer.notify([
        {
          isIntersecting: false,
          boundingClientRect: { top: 2000 } as DOMRect,
          rootBounds: { top: 64 } as DOMRect,
        },
      ]),
    )
    expect(screen.getByTestId("ranking-self-pinned")).toBeInTheDocument()

    const [jumpFromPin] = screen
      .getAllByRole("button", { name: "Aller à ma position" })
      .filter((b) => b.closest(".sticky"))
    await userEvent.click(jumpFromPin)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" })
    expect(document.activeElement).toBe(
      screen.getByTestId("ranking-self").closest("li"),
    )

    act(() => observer.notify([{ isIntersecting: true }]))
    expect(screen.queryByTestId("ranking-self-pinned")).not.toBeInTheDocument()
  })
})
