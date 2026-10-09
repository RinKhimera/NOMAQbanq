import { describe, expect, it } from "vitest"
import {
  type ListExam,
  type ListParticipation,
  closesBeforeBudget,
  examListStats,
  groupByMonth,
  isEligible,
  openExamState,
  pastScoreState,
  shownRemainingMs,
  sortOpenExams,
} from "@/lib/exam-list"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const NOW = Date.parse("2026-09-26T15:00:00Z")

const exam = (over: Partial<ListExam> = {}): ListExam => ({
  id: "e1",
  endDate: NOW + 2 * 24 * HOUR,
  completionTime: 318 * 60,
  audienceType: "subscribers",
  isActive: true,
  userParticipation: null,
  ...over,
})

const started = (over: Partial<ListParticipation> = {}): ListParticipation => ({
  status: "in_progress",
  score: null,
  completedAt: null,
  answeredCount: 87,
  timing: {
    startedAt: NOW - 2 * HOUR,
    budgetSeconds: 318 * 60,
    pauseCreditMs: 0,
    pauseInProgress: null,
  },
  ...over,
})

describe("openExamState", () => {
  it("sans participation : ouvert si l'accès le permet, réservé sinon", () => {
    expect(openExamState(exam(), NOW, true)).toBe("eligible")
    expect(openExamState(exam(), NOW, false)).toBe("locked")
  })

  it("un examen sur invitation est passable sans abonnement", () => {
    expect(isEligible({ audienceType: "restricted" }, false)).toBe(true)
    expect(
      openExamState(exam({ audienceType: "restricted" }), NOW, false),
    ).toBe("eligible")
  })

  it("participation démarrée : en cours, en pause, ou temps écoulé selon l'horloge", () => {
    const e = exam({ userParticipation: started() })
    expect(openExamState(e, NOW, true)).toBe("started")

    const paused = exam({
      userParticipation: started({
        timing: {
          ...started().timing!,
          pauseInProgress: { startedAt: NOW - 10 * MINUTE, capMinutes: 45 },
        },
      }),
    })
    expect(openExamState(paused, NOW, true)).toBe("paused")
    // La pause plafonnée est consommée : le chronomètre a repris.
    expect(openExamState(paused, NOW + 40 * MINUTE, true)).toBe("started")

    // Budget épuisé, examen encore ouvert : le cron ne l'a pas encore balayée.
    expect(openExamState(e, NOW + 6 * HOUR, true)).toBe("elapsed")
  })

  it("participation en cours mais accès échu : réservé aux abonnés", () => {
    expect(
      openExamState(exam({ userParticipation: started() }), NOW, false),
    ).toBe("locked")
  })

  it("suspendu sans participation : « suspendu », quel que soit l'accès", () => {
    const e = exam({ isActive: false })
    expect(openExamState(e, NOW, true)).toBe("suspended")
    expect(openExamState(e, NOW, false)).toBe("suspended")
    expect(
      openExamState({ ...e, audienceType: "restricted" }, NOW, false),
    ).toBe("suspended")
  })

  it("suspendu : une participation en cours continue, une soumise reste soumise", () => {
    expect(
      openExamState(
        exam({ isActive: false, userParticipation: started() }),
        NOW,
        true,
      ),
    ).toBe("started")
    expect(
      openExamState(
        exam({
          isActive: false,
          userParticipation: started({ status: "completed", completedAt: NOW }),
        }),
        NOW,
        true,
      ),
    ).toBe("submitted")
  })

  it("soumise : « soumis », quel que soit l'accès", () => {
    const e = exam({
      userParticipation: started({ status: "completed", completedAt: NOW }),
    })
    expect(openExamState(e, NOW, false)).toBe("submitted")
  })

  it("se trient : temps écoulé, en cours, ouvert, réservé, soumis", () => {
    const states = sortOpenExams(
      (
        [
          "submitted",
          "eligible",
          "paused",
          "locked",
          "suspended",
          "elapsed",
          "started",
        ] as const
      ).map((state) => ({ state })),
    ).map((x) => x.state)
    expect(states).toEqual([
      "elapsed",
      "paused",
      "started",
      "eligible",
      "locked",
      "suspended",
      "submitted",
    ])
  })
})

describe("temps restant affiché", () => {
  it("le plus court du budget et de la fermeture, en le disant", () => {
    const timing = started().timing!
    const roomy = shownRemainingMs({ endDate: NOW + 24 * HOUR }, timing, NOW)
    expect(roomy).toEqual({
      ms: 318 * MINUTE - 2 * HOUR,
      limitedByClosing: false,
    })
    const tight = shownRemainingMs({ endDate: NOW + HOUR }, timing, NOW)
    expect(tight).toEqual({ ms: HOUR, limitedByClosing: true })
  })

  it("closesBeforeBudget : la fermeture tombe avant la durée prévue", () => {
    expect(
      closesBeforeBudget(
        { endDate: NOW + HOUR, completionTime: 318 * 60 },
        NOW,
      ),
    ).toBe(true)
    expect(
      closesBeforeBudget(
        { endDate: NOW + 6 * HOUR, completionTime: 318 * 60 },
        NOW,
      ),
    ).toBe(false)
  })
})

describe("examListStats", () => {
  const graded = (score: number | null): ListParticipation =>
    started({ status: "completed", score, completedAt: NOW })

  it("passés = soumis, retenu compris ; réussis et moyenne sur les scores lisibles, au plancher", () => {
    const stats = examListStats([
      exam({ userParticipation: graded(59.67) }),
      exam({ userParticipation: graded(80) }),
      exam({ userParticipation: graded(null) }),
      exam({ userParticipation: started() }),
      exam(),
    ])
    // (59,67 + 80) / 2 = 69,835 → 69 ; 59,67 n'est pas « réussi ».
    expect(stats).toEqual({ taken: 3, graded: 2, passed: 1, average: 69 })
  })

  it("aucun score lisible : moyenne nulle, jamais 0", () => {
    expect(examListStats([exam({ userParticipation: graded(null) })])).toEqual({
      taken: 1,
      graded: 0,
      passed: 0,
      average: null,
    })
  })
})

describe("pastScoreState", () => {
  it("score au plancher, retenu, clôture en cours, non passé", () => {
    expect(
      pastScoreState(started({ status: "completed", score: 59.67 })),
    ).toEqual({ kind: "score", score: 59 })
    expect(pastScoreState(started({ status: "auto_submitted" }))).toEqual({
      kind: "withheld",
    })
    expect(pastScoreState(started())).toEqual({ kind: "closing" })
    expect(pastScoreState(null)).toEqual({ kind: "none" })
  })
})

describe("groupByMonth", () => {
  it("regroupe les mois consécutifs dans l'ordre reçu", () => {
    const groups = groupByMonth(
      [
        { endDate: Date.parse("2026-09-21T00:00:00Z"), id: "a" },
        { endDate: Date.parse("2026-09-07T00:00:00Z"), id: "b" },
        { endDate: Date.parse("2026-08-10T00:00:00Z"), id: "c" },
      ],
      (d) => new Date(d).toISOString().slice(0, 7),
    )
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ["2026-09", ["a", "b"]],
      ["2026-08", ["c"]],
    ])
  })
})
