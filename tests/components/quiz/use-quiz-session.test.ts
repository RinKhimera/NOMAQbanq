import { act, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AnswersMap } from "@/components/quiz/runner/types"
import { makeQuestion, renderSession } from "../../helpers/quiz-session"

describe("useQuizSession — état initial", () => {
  it("sans options : première question, aucun marquage, pas de chrono, pas en pause", () => {
    const { result } = renderSession({ n: 5 })
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentQuestion?._id).toBe("q1")
    expect(result.current.flagged.size).toBe(0)
    expect(result.current.timer).toBeNull()
    expect(result.current.isPaused).toBe(false)
  })
})

describe("useQuizSession — navigation", () => {
  it("goNext avance et est borné", () => {
    const { result } = renderSession({ n: 3 })
    act(() => result.current.goNext())
    expect(result.current.currentIndex).toBe(1)
    act(() => result.current.goNext())
    act(() => result.current.goNext())
    expect(result.current.currentIndex).toBe(2) // bornée à totalQuestions-1
  })

  it("goPrevious recule et est borné", () => {
    const { result } = renderSession({ n: 3 })
    act(() => result.current.goPrevious())
    expect(result.current.currentIndex).toBe(0) // déjà à 0
    act(() => result.current.goNext())
    act(() => result.current.goPrevious())
    expect(result.current.currentIndex).toBe(0)
  })

  it("goTo navigue vers un index valide", () => {
    const { result } = renderSession({ n: 5 })
    act(() => result.current.goTo(3))
    expect(result.current.currentIndex).toBe(3)
  })

  it("goTo ignore les index hors-limites", () => {
    const { result } = renderSession({ n: 3 })
    act(() => result.current.goTo(99))
    expect(result.current.currentIndex).toBe(0) // inchangé
    act(() => result.current.goTo(-1))
    expect(result.current.currentIndex).toBe(0) // inchangé
  })
})

describe("useQuizSession — answerSelect", () => {
  const oneQuestion = [makeQuestion("q1", ["A", "B"])]

  // Mode tuteur (feedback immédiat) = deux temps : answerSelect met en attente,
  // confirmAnswer enregistre + révèle, puis la question est verrouillée.
  it("mode tuteur : answerSelect met en attente sans révéler ni appeler onAnswer", async () => {
    const onAnswer = vi.fn()
    const { result } = renderSession({
      questions: oneQuestion,
      mode: { feedback: "immediate" },
      callbacks: { onAnswer },
    })
    await act(async () => {
      await result.current.answerSelect(1) // "B"
    })
    expect(onAnswer).not.toHaveBeenCalled()
    expect(result.current.revealed["q1"]).toBeUndefined()
    expect(result.current.pendingSelection["q1"]).toBe("B")
    expect(result.current.answers["q1"]).toBeUndefined()
  })

  it("mode tuteur : confirmAnswer enregistre puis révèle la correction", async () => {
    const onAnswer = vi.fn().mockResolvedValue({
      ok: true,
      reveal: { correctAnswer: "B", explanation: "e", references: [] },
    })
    const { result } = renderSession({
      questions: oneQuestion,
      mode: { feedback: "immediate" },
      callbacks: { onAnswer },
    })
    await act(async () => {
      await result.current.answerSelect(1) // "B"
    })
    await act(async () => {
      await result.current.confirmAnswer()
    })
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith("q1", "B")
    expect(result.current.answers["q1"]).toEqual({
      selected: "B",
      isCorrect: true,
    })
    expect(result.current.revealed["q1"]).toMatchObject({ correctAnswer: "B" })
    expect(result.current.pendingSelection["q1"]).toBeUndefined()
  })

  it("mode tuteur : clé retenue → question validée sans correction ni isCorrect", async () => {
    const onAnswer = vi.fn().mockResolvedValue({
      ok: true,
      reveal: { keyWithheld: true },
    })
    const { result } = renderSession({
      questions: oneQuestion,
      mode: { feedback: "immediate" },
      callbacks: { onAnswer },
    })
    await act(async () => {
      await result.current.answerSelect(1) // "B"
    })
    await act(async () => {
      await result.current.confirmAnswer()
    })
    expect(result.current.answers["q1"]).toEqual({ selected: "B" })
    expect(result.current.revealed["q1"]).toEqual({ keyWithheld: true })
    expect(result.current.pendingSelection["q1"]).toBeUndefined()
  })

  it("mode tuteur : answerSelect est un no-op après révélation (verrou)", async () => {
    const onAnswer = vi.fn().mockResolvedValue({
      ok: true,
      reveal: { correctAnswer: "B", explanation: "", references: [] },
    })
    const { result } = renderSession({
      questions: oneQuestion,
      mode: { feedback: "immediate" },
      callbacks: { onAnswer },
    })
    await act(async () => {
      await result.current.answerSelect(1) // "B"
    })
    await act(async () => {
      await result.current.confirmAnswer()
    })
    await act(async () => {
      await result.current.answerSelect(0) // tente de changer après validation
    })
    expect(result.current.answers["q1"]?.selected).toBe("B")
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it("answerSelect en mode deferred ne stocke pas isCorrect", async () => {
    const onAnswer = vi.fn().mockResolvedValue({ ok: true }) // no reveal
    const { result } = renderSession({
      questions: oneQuestion,
      callbacks: { onAnswer },
    })
    await act(async () => {
      await result.current.answerSelect(0)
    })
    expect(result.current.answers["q1"]?.selected).toBe("A")
    expect(result.current.answers["q1"]?.isCorrect).toBeUndefined()
    expect(result.current.revealed["q1"]).toBeUndefined()
  })

  it("answerSelect ne met pas à jour si onAnswer retourne ok:false", async () => {
    const onAnswer = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Serveur KO" })
    const { result } = renderSession({
      questions: oneQuestion,
      callbacks: { onAnswer },
    })
    await act(async () => {
      await result.current.answerSelect(0)
    })
    expect(result.current.answers["q1"]).toBeUndefined()
  })

  it("answeredCount augmente à chaque nouvelle réponse", async () => {
    const { result } = renderSession({ n: 3 })
    expect(result.current.answeredCount).toBe(0)
    await act(async () => {
      await result.current.answerSelect(0)
    })
    expect(result.current.answeredCount).toBe(1)
  })
})

describe("useQuizSession — initialAnswers & initialFlags", () => {
  it("initialise les réponses depuis initialAnswers", () => {
    const initialAnswers: AnswersMap = { q1: { selected: "A" } }
    const { result } = renderSession({ n: 3, initialAnswers })
    expect(result.current.answers["q1"]).toEqual({ selected: "A" })
    expect(result.current.answeredCount).toBe(1)
  })

  it("réhydrate les flags depuis initialFlags", () => {
    const { result } = renderSession({
      n: 3,
      initialFlags: new Set(["q1", "q3"]),
    })
    expect(result.current.flagged.has("q1")).toBe(true)
    expect(result.current.flagged.has("q3")).toBe(true)
    expect(result.current.flagged.has("q2")).toBe(false)
  })
})

describe("useQuizSession — toggle flag", () => {
  it("toggleFlag ajoute et retire la question courante + appelle onFlag", async () => {
    const onFlag = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderSession({ n: 3, callbacks: { onFlag } })
    act(() => result.current.toggleFlag())
    expect(result.current.flagged.has("q1")).toBe(true)
    expect(onFlag).toHaveBeenCalledWith("q1", true)

    act(() => result.current.toggleFlag())
    expect(result.current.flagged.has("q1")).toBe(false)
    // Envois sérialisés par question : le second onFlag part quand le premier
    // est réglé, pas de façon synchrone
    await waitFor(() => expect(onFlag).toHaveBeenCalledWith("q1", false))
  })
})

describe("useQuizSession — finish dialog", () => {
  it("requestFinish ouvre le dialog", () => {
    const { result } = renderSession()
    expect(result.current.finishDialogOpen).toBe(false)
    act(() => result.current.requestFinish())
    expect(result.current.finishDialogOpen).toBe(true)
  })

  it("confirmFinish appelle onFinish avec isAutoSubmit false par défaut", async () => {
    const { result, callbacks } = renderSession()
    await act(async () => {
      await result.current.confirmFinish()
    })
    expect(callbacks.onFinish).toHaveBeenCalledWith({ isAutoSubmit: false })
  })

  it("confirmFinish avec isAutoSubmit:true passe le flag", async () => {
    const { result, callbacks } = renderSession()
    await act(async () => {
      await result.current.confirmFinish({ isAutoSubmit: true })
    })
    expect(callbacks.onFinish).toHaveBeenCalledWith({ isAutoSubmit: true })
  })
})

describe("useQuizSession — timer composé", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("sans timer (entraînement), ne s'auto-soumet PAS au montage ni après écoulement", async () => {
    // Un mode sans timer expose totalSeconds=0 : sans garde, onExpire part au
    // montage et la session est soumise vide.
    const { callbacks } = renderSession({ n: 5 })
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
    expect(callbacks.onFinish).not.toHaveBeenCalled()
  })

  it("onExpire du timer appelle confirmFinish({isAutoSubmit:true})", async () => {
    const { callbacks } = renderSession({
      timer: { start: Date.now(), totalSeconds: 1 },
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(callbacks.onFinish).toHaveBeenCalledWith({ isAutoSubmit: true })
  })

  it("budget déjà épuisé au montage : l'auto-soumission part quand même", async () => {
    // Le premier tick du chrono expire dans un effet qui court AVANT celui qui
    // pose la référence d'auto-soumission : sans report, un examen ouvert
    // après son budget ne se soumettrait jamais.
    const start = Date.now()
    const { callbacks } = renderSession({
      timer: { start, totalSeconds: 60, initialNow: start + 3_600_000 },
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(callbacks.onFinish).toHaveBeenCalledTimes(1)
    expect(callbacks.onFinish).toHaveBeenCalledWith({ isAutoSubmit: true })
  })

  it("l'instant serveur d'une réponse ré-ancre le chrono (veille, retour arrière)", async () => {
    const start = Date.now()
    const THIRTY_MINUTES = 30 * 60 * 1000
    const onAnswer = vi
      .fn()
      .mockResolvedValue({ ok: true, serverNow: start + THIRTY_MINUTES })
    const { result } = renderSession({
      mode: { kind: "exam" },
      timer: { start },
      callbacks: { onAnswer },
    })
    expect(result.current.timer?.remainingMs).toBe(3_600_000)
    await act(async () => {
      await result.current.answerSelect(0)
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.timer?.remainingMs).toBe(
      3_600_000 - THIRTY_MINUTES - 1000,
    )
  })

  it("l'instant serveur de la reprise de pause ré-ancre le chrono", async () => {
    const start = Date.now()
    const TEN_MINUTES = 10 * 60 * 1000
    const onPause = vi.fn().mockResolvedValue({ ok: true })
    const onResume = vi.fn().mockResolvedValue({
      ok: true,
      totalPauseDurationMs: TEN_MINUTES,
      serverNow: start + TEN_MINUTES + 30 * 60 * 1000,
    })
    const { result } = renderSession({
      mode: { kind: "exam", pause: "rest" },
      timer: { start },
      callbacks: { onPause, onResume },
    })
    await act(async () => {
      await result.current.pause()
    })
    // Veille pendant la pause : l'horloge monotone n'a rien vu.
    await act(async () => {
      await result.current.resume()
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    // 40 min serveur − 10 min de crédit = 30 min consommées, puis 1 s.
    expect(result.current.timer?.remainingMs).toBe(
      3_600_000 - 30 * 60 * 1000 - 1000,
    )
  })

  it("le début de pause est l'instant serveur de pauseExam ; la reprise l'efface", async () => {
    const start = Date.now()
    const onPause = vi
      .fn()
      .mockResolvedValue({ ok: true, pauseStartedAt: start + 5000 })
    const onResume = vi
      .fn()
      .mockResolvedValue({ ok: true, totalPauseDurationMs: 1000 })
    const { result } = renderSession({
      mode: { kind: "exam", pause: "rest" },
      timer: { start },
      callbacks: { onPause, onResume },
    })
    expect(result.current.pauseStartedAt).toBeUndefined()
    await act(async () => {
      await result.current.pause()
    })
    expect(result.current.pauseStartedAt).toBe(start + 5000)
    await act(async () => {
      await result.current.resume()
    })
    expect(result.current.pauseStartedAt).toBeUndefined()
  })

  it("réveil de l'onglet après une veille (l'horloge murale a avancé, pas la monotone) : demande l'heure au serveur et ré-ancre", async () => {
    const start = Date.now()
    const THIRTY_MINUTES = 30 * 60 * 1000
    const onSyncClock = vi
      .fn()
      .mockResolvedValue({ ok: true, serverNow: start + THIRTY_MINUTES })
    const { result } = renderSession({
      mode: { kind: "exam" },
      timer: { start },
      callbacks: { onSyncClock },
    })
    // Veille : `Date.now()` saute de 30 min, `performance.now()` ne bouge pas.
    vi.setSystemTime(start + THIRTY_MINUTES)
    // Le chrono tique (et re-rend) avant que l'onglet ne signale son réveil :
    // la base de dérive doit survivre à ce re-rendu.
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(onSyncClock).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.timer?.remainingMs).toBe(
      3_600_000 - THIRTY_MINUTES - 1000,
    )
  })

  it("réveil sans réseau : la lecture échoue, la dérive reste armée et le retour du réseau (`online`) la rejoue", async () => {
    const start = Date.now()
    const THIRTY_MINUTES = 30 * 60 * 1000
    const onSyncClock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true, serverNow: start + THIRTY_MINUTES })
    const { result } = renderSession({
      mode: { kind: "exam" },
      timer: { start },
      callbacks: { onSyncClock },
    })
    vi.setSystemTime(start + THIRTY_MINUTES)
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(result.current.timer?.remainingMs).toBe(3_600_000)
    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })
    expect(onSyncClock).toHaveBeenCalledTimes(2)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.timer?.remainingMs).toBe(
      3_600_000 - THIRTY_MINUTES - 1000,
    )
  })

  it("jumeau : retour de visibilité sans dérive (ou dérive d'un simple RTT) → aucun appel serveur", async () => {
    const start = Date.now()
    const onSyncClock = vi
      .fn()
      .mockResolvedValue({ ok: true, serverNow: start })
    renderSession({
      mode: { kind: "exam" },
      timer: { start },
      callbacks: { onSyncClock },
    })
    await act(async () => {
      vi.advanceTimersByTime(60_000)
      vi.setSystemTime(Date.now() + 2000)
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(onSyncClock).not.toHaveBeenCalled()
  })

  it("rechargée en pause : le début de pause vient de la vue serveur", () => {
    const start = Date.now()
    const { result } = renderSession({
      initialPause: {
        isPaused: true,
        totalPauseDurationMs: 0,
        pauseStartedAtMs: start + 9000,
      },
      mode: { kind: "exam", pause: "rest" },
      timer: { start },
    })
    expect(result.current.pauseStartedAt).toBe(start + 9000)
  })

  it("auto-soumission échouée (réseau) : le verrou se relâche, le refus TIME_UP suivant la relance", async () => {
    const onAnswer = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Temps écoulé.", timeUp: true })
    const onFinish = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true })
    const { result } = renderSession({
      mode: { kind: "exam" },
      timer: { start: Date.now() },
      callbacks: { onAnswer, onFinish },
    })
    await act(async () => {
      await result.current.answerSelect(0)
    })
    await act(async () => {
      await result.current.answerSelect(1)
    })
    expect(onFinish).toHaveBeenCalledTimes(2)
  })

  it("remise manuelle après expiration du chrono : envoyée en auto-soumission (le budget refuserait une remise ordinaire)", async () => {
    const onFinish = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true })
    const { result } = renderSession({
      mode: { kind: "exam" },
      timer: { start: Date.now(), totalSeconds: 1 },
      callbacks: { onFinish },
    })
    // L'expiration tente l'auto-soumission, qui échoue (réseau).
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
    // L'étudiant clique « Terminer » : la remise part exemptée du budget.
    await act(async () => {
      await result.current.confirmFinish()
    })
    expect(onFinish).toHaveBeenLastCalledWith({ isAutoSubmit: true })
  })

  it("temps écoulé côté serveur (réponse refusée timeUp) : auto-soumission, une seule fois même si le chrono expire ensuite", async () => {
    // Le chrono client est en retard (veille) : le serveur refuse la réponse.
    // Réessayer ne sert à rien ; l'examen se soumet comme à l'expiration.
    const onAnswer = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Temps écoulé.", timeUp: true })
    const { result, callbacks } = renderSession({
      mode: { kind: "exam" },
      timer: { start: Date.now(), totalSeconds: 2 },
      callbacks: { onAnswer },
    })
    await act(async () => {
      await result.current.answerSelect(0)
    })
    expect(callbacks.onFinish).toHaveBeenCalledWith({ isAutoSubmit: true })
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(callbacks.onFinish).toHaveBeenCalledTimes(1)
  })
})

describe("useQuizSession — raccourcis clavier", () => {
  it("ArrowRight appelle goNext", () => {
    const { result } = renderSession({ n: 3 })
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
    })
    expect(result.current.currentIndex).toBe(1)
  })

  it("ArrowLeft appelle goPrevious (borné à 0)", () => {
    const { result } = renderSession({ n: 3 })
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
    })
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))
    })
    expect(result.current.currentIndex).toBe(0)
  })
})

describe("useQuizSession — pause (rest break)", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("isPaused initial dérive de initialPause", () => {
    const { result } = renderSession({
      initialPause: { isPaused: true, totalPauseDurationMs: 5000 },
    })
    expect(result.current.isPaused).toBe(true)
  })

  it("pause() appelle onPause, passe isPaused=true et gèle le timer", async () => {
    const onPause = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderSession({
      timer: { start: Date.now() },
      callbacks: { onPause },
    })

    // Avance un peu pour avoir une valeur de référence
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.isPaused).toBe(false)

    await act(async () => {
      await result.current.pause()
    })
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(result.current.isPaused).toBe(true)

    const frozen = result.current.timer?.remainingMs
    // Le timer est gelé : avancer le temps ne change rien
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.timer?.remainingMs).toBe(frozen)
  })

  it("pause() est un no-op si déjà en pause", async () => {
    const onPause = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderSession({
      initialPause: { isPaused: true, totalPauseDurationMs: 0 },
      callbacks: { onPause },
    })
    await act(async () => {
      await result.current.pause()
    })
    expect(onPause).not.toHaveBeenCalled()
  })

  it("resume() applique le totalPauseDurationMs serveur et reprend le timer", async () => {
    const onResume = vi
      .fn()
      .mockResolvedValue({ ok: true, totalPauseDurationMs: 30_000 })
    // L'examen tourne depuis 60 s : une pause de 30 s a pu s'y loger. Un examen
    // qui aurait cumulé de la pause avant de démarrer n'existe pas.
    const now = Date.now()
    const { result } = renderSession({
      // Démarre en pause, sans offset cumulé
      initialPause: { isPaused: true, totalPauseDurationMs: 0 },
      timer: { start: now - 60_000, initialNow: now },
      callbacks: { onResume },
    })
    expect(result.current.isPaused).toBe(true)

    await act(async () => {
      await result.current.resume()
    })
    expect(onResume).toHaveBeenCalledTimes(1)
    expect(result.current.isPaused).toBe(false)

    // Le timer reprend : avancer le temps réduit remainingMs
    const beforeTick = result.current.timer?.remainingMs ?? 0
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    const afterTick = result.current.timer?.remainingMs ?? 0
    expect(afterTick).toBeLessThan(beforeTick)

    // L'offset de pause serveur (30 s) est crédité : 63 s écoulées − 30 s de
    // pause = 33 s consommées, donc ~3567 s restantes. Sans l'offset on serait à
    // 3537 s : le seuil discrimine.
    expect(afterTick).toBeGreaterThan(3560 * 1000)
    expect(afterTick).toBeLessThanOrEqual(3600 * 1000)
  })

  it("resume() est un no-op si pas en pause", async () => {
    const onResume = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderSession({ callbacks: { onResume } })
    await act(async () => {
      await result.current.resume()
    })
    expect(onResume).not.toHaveBeenCalled()
  })

  it.each([
    {
      cas: "une pause serveur déjà créditée",
      initialPause: { isPaused: false, totalPauseDurationMs: 30_000 },
      used: true,
    },
    {
      cas: "aucune pause serveur enregistrée",
      initialPause: { isPaused: false, totalPauseDurationMs: 0 },
      used: false,
    },
    {
      // Rechargement en pleine pause : le crédit n'arrive qu'à la reprise, mais
      // le bouton ne doit pas clignoter sous l'overlay.
      cas: "un rechargement en pleine pause, crédit encore nul",
      initialPause: { isPaused: true, totalPauseDurationMs: 0 },
      used: true,
    },
  ])(
    "pauseAlreadyUsed au montage avec $cas : $used",
    ({ initialPause, used }) => {
      const { result } = renderSession({ initialPause })
      expect(result.current.pauseAlreadyUsed).toBe(used)
    },
  )

  it("pauseAlreadyUsed passe de faux à vrai quand la pause est prise puis reprise", async () => {
    const { result } = renderSession({
      callbacks: {
        onPause: vi.fn().mockResolvedValue({ ok: true }),
        onResume: vi
          .fn()
          .mockResolvedValue({ ok: true, totalPauseDurationMs: 30_000 }),
      },
    })
    expect(result.current.pauseAlreadyUsed).toBe(false)

    await act(async () => {
      await result.current.pause()
    })
    expect(result.current.isPaused).toBe(true)
    await act(async () => {
      await result.current.resume()
    })
    expect(result.current.isPaused).toBe(false)
    expect(result.current.pauseAlreadyUsed).toBe(true)
  })

  it("resume() conserve l'offset existant si le serveur ne renvoie pas de durée", async () => {
    const onResume = vi.fn().mockResolvedValue({ ok: true }) // pas de totalPauseDurationMs
    const now = Date.now()
    const { result } = renderSession({
      initialPause: { isPaused: true, totalPauseDurationMs: 12_000 },
      timer: { start: now - 60_000, initialNow: now },
      callbacks: { onResume },
    })
    await act(async () => {
      await result.current.resume()
    })
    expect(result.current.isPaused).toBe(false)
    // 60 s écoulées − 12 s de pause déjà créditée = 48 s consommées.
    expect(result.current.timer?.remainingMs).toBe(3_552_000)
  })
})
