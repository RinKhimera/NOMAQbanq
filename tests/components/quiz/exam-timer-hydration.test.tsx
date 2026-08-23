import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useExamTimer } from "@/components/quiz/runner/use-exam-timer"
import { formatExamTime } from "@/lib/exam-timer"

const START = 1_700_000_000_000
const TOTAL_SECONDS = 3600

/** Réduction du chrono d'examen : un texte à la seconde issu de `useExamTimer`. */
const Chrono = ({ initialNow }: { initialNow: number }) => {
  const { remainingMs } = useExamTimer({
    serverStartTime: START,
    totalSeconds: TOTAL_SECONDS,
    initialNow,
    isPaused: false,
    totalPauseDurationMs: 0,
    onExpire: () => {},
  })
  return <span>{formatExamTime(remainingMs)}</span>
}

const hydrate = async (html: string, node: React.ReactElement) => {
  const container = document.createElement("div")
  container.innerHTML = html
  document.body.appendChild(container)
  const recoverable: unknown[] = []
  await act(async () => {
    hydrateRoot(container, node, {
      onRecoverableError: (err) => recoverable.push(err),
    })
  })
  return { container, recoverable }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ""
})

describe("chrono d'examen — hydratation", () => {
  it("hydrate proprement quand l'horloge a avancé entre le HTML serveur et l'hydratation", async () => {
    // Reprise d'un examen en cours : le serveur rend le décompte à SA seconde.
    const serverNow = START + 60_000
    vi.setSystemTime(serverNow)
    const html = renderToString(<Chrono initialNow={serverNow} />)
    expect(html).toContain("00:59:00")

    // Livraison + hydratation : 2,4 s plus tard, deux secondes de décompte plus loin.
    vi.setSystemTime(serverNow + 2_400)

    const { container, recoverable } = await hydrate(
      html,
      <Chrono initialNow={serverNow} />,
    )

    expect(recoverable).toEqual([])

    // L'ancre ne fige pas l'affichage : le premier tick reprend l'horloge locale.
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(container.textContent).toBe("00:58:56")
  })

  it("un chrono ancré sur l'horloge locale, lui, casse l'hydratation", async () => {
    // Test jumeau : sans ancre serveur (l'ancien `useState(computeRemaining)`),
    // les deux passes lisent des instants différents. Il fixe ce que le test
    // précédent démontre — sans lui, il passerait chrono gardé ou non.
    const serverNow = START + 60_000
    vi.setSystemTime(serverNow)
    const html = renderToString(<Chrono initialNow={Date.now()} />)

    vi.setSystemTime(serverNow + 2_400)

    const { recoverable } = await hydrate(
      html,
      <Chrono initialNow={Date.now()} />,
    )

    expect(recoverable.length).toBeGreaterThan(0)
  })
})
