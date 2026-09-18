import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  type Actor,
  type Executor,
  refusalMessage,
  requireAttempt,
} from "@/features/attempts/guard"

// Le module est la table de politique de la spec : une ligne = un test. Le
// faux exécuteur sert les lignes que le SELECT verrouillé renverrait ; l'accès
// payant est doublé (sa requête vit dans `features/payments/dal`).
const { mocks } = vi.hoisted(() => ({
  mocks: { hasActiveAccess: vi.fn(async () => true) },
}))
vi.mock("@/db", () => ({ db: {} }))
vi.mock("@/features/payments/dal", () => ({
  hasActiveAccess: mocks.hasActiveAccess,
}))

const NOW = 1_000_000
const student = { id: "u1", role: "user" as const }
const admin = { id: "adm", role: "admin" as const }

let rows: Record<string, unknown>[]
const execute = vi.fn(async () => ({ rows }))
const exec = { execute } as unknown as Executor

beforeEach(() => {
  rows = []
  execute.mockClear()
  mocks.hasActiveAccess.mockReset().mockResolvedValue(true)
})

const trainingRow = (extra: Record<string, unknown> = {}) => ({
  id: "s1",
  status: "in_progress",
  mode: "test",
  question_count: 10,
  // Instants en epoch ms : ce que le SELECT du guard projette (`float8`).
  expires_at: NOW + 60_000,
  ...extra,
})

describe("requireAttempt — entraînement", () => {
  it("answer : session ouverte → tentative verrouillée avec ses champs", async () => {
    rows = [trainingRow()]
    const res = await requireAttempt(exec, {
      kind: "training",
      ref: "s1",
      actor: student,
      now: NOW,
      verb: "answer",
    })
    expect(res).toEqual({
      ok: true,
      attempt: {
        kind: "training",
        id: "s1",
        mode: "test",
        questionCount: 10,
        expiresAt: NOW + 60_000,
      },
    })
  })

  it("le SELECT porte la propriété dans le WHERE et un verrou de ligne", async () => {
    rows = [trainingRow()]
    await requireAttempt(exec, {
      kind: "training",
      ref: "s1",
      actor: student,
      now: NOW,
      verb: "answer",
    })
    const query = (execute.mock.calls as unknown[][])[0]?.[0] as {
      queryChunks: unknown[]
    }
    const text = JSON.stringify(query.queryChunks)
    expect(text).toContain("user_id")
    expect(text).toMatch(/for update/i)
  })

  it("session d'autrui ou inexistante → NOT_FOUND (aucune ligne)", async () => {
    rows = []
    const res = await requireAttempt(exec, {
      kind: "training",
      ref: "s1",
      actor: student,
      now: NOW,
      verb: "answer",
    })
    expect(res).toEqual({ ok: false, code: "NOT_FOUND" })
  })

  it("session close (quel que soit le verbe) → NOT_IN_PROGRESS", async () => {
    rows = [trainingRow({ status: "completed" })]
    for (const verb of ["answer", "close", "abandon"] as const) {
      expect(
        await requireAttempt(exec, {
          kind: "training",
          ref: "s1",
          actor: student,
          now: NOW,
          verb,
        }),
      ).toEqual({ ok: false, code: "NOT_IN_PROGRESS" })
    }
  })

  // La clôture par expiration appartient au cron : le refus n'écrit rien.
  it.each(["answer", "close"] as const)(
    "%s : TTL dépassé → EXPIRED, aucune écriture",
    async (verb) => {
      rows = [trainingRow({ expires_at: NOW - 1 })]
      const res = await requireAttempt(exec, {
        kind: "training",
        ref: "s1",
        actor: student,
        now: NOW,
        verb,
      })
      expect(res).toEqual({ ok: false, code: "EXPIRED" })
      expect(execute).toHaveBeenCalledTimes(1)
    },
  )

  it("TTL atteint à l'instant exact → encore ouverte (même borne que le cron)", async () => {
    rows = [trainingRow({ expires_at: NOW })]
    const res = await requireAttempt(exec, {
      kind: "training",
      ref: "s1",
      actor: student,
      now: NOW,
      verb: "answer",
    })
    expect(res.ok).toBe(true)
  })

  it.each(["answer", "close"] as const)(
    "%s : accès entraînement expiré → ACCESS_EXPIRED",
    async (verb) => {
      rows = [trainingRow()]
      mocks.hasActiveAccess.mockResolvedValueOnce(false)
      const res = await requireAttempt(exec, {
        kind: "training",
        ref: "s1",
        actor: student,
        now: NOW,
        verb,
      })
      expect(res).toEqual({ ok: false, code: "ACCESS_EXPIRED" })
      expect(mocks.hasActiveAccess).toHaveBeenCalledWith(exec, {
        userId: "u1",
        type: "training",
        now: NOW,
      })
    },
  )

  it("admin : aucune garde d'accès payant", async () => {
    rows = [trainingRow()]
    mocks.hasActiveAccess.mockResolvedValueOnce(false)
    const res = await requireAttempt(exec, {
      kind: "training",
      ref: "s1",
      actor: admin,
      now: NOW,
      verb: "answer",
    })
    expect(res.ok).toBe(true)
    expect(mocks.hasActiveAccess).not.toHaveBeenCalled()
  })

  // abandon : ni TTL ni accès — on peut toujours renoncer.
  it("abandon : session expirée sans accès → autorisé", async () => {
    rows = [trainingRow({ expires_at: NOW - 1 })]
    mocks.hasActiveAccess.mockResolvedValue(false)
    const res = await requireAttempt(exec, {
      kind: "training",
      ref: "s1",
      actor: student,
      now: NOW,
      verb: "abandon",
    })
    expect(res.ok).toBe(true)
    expect(mocks.hasActiveAccess).not.toHaveBeenCalled()
  })
})

// Examen : budget 100 s démarré à NOW − 50 s ; fenêtre largement ouverte.
const examRow = (extra: Record<string, unknown> = {}) => ({
  id: "p1",
  status: "in_progress",
  started_at: NOW - 50_000,
  pause_started_at: null,
  // bigint → le driver pg rend une chaîne.
  total_pause_duration_ms: "0",
  start_date: NOW - 3_600_000,
  end_date: NOW + 3_600_000,
  completion_time: 100,
  pause_duration_minutes: 20,
  enable_pause: true,
  audience_type: "subscribers",
  ...extra,
})

const exam = (
  verb: "answer" | "close" | "flag" | "pause" | "resume" | "abandon",
  opts: { actor?: Actor; now?: number; isAutoSubmit?: boolean } = {},
) =>
  requireAttempt(exec, {
    kind: "exam",
    ref: "e1",
    actor: opts.actor ?? student,
    now: opts.now ?? NOW,
    verb,
    isAutoSubmit: opts.isAutoSubmit,
  })

describe("requireAttempt — examen", () => {
  it("answer : participation ouverte → horloge et réglages de l'examen", async () => {
    rows = [examRow({ total_pause_duration_ms: "5000" })]
    expect(await exam("answer")).toEqual({
      ok: true,
      attempt: {
        kind: "exam",
        id: "p1",
        timing: {
          startedAt: NOW - 50_000,
          budgetSeconds: 100,
          pauseCreditMs: 5_000,
          pauseInProgress: null,
        },
        exam: {
          enablePause: true,
          pauseDurationMinutes: 20,
          audienceType: "subscribers",
        },
      },
    })
  })

  // Le verrou ne porte que la participation : verrouiller la ligne `exams`
  // sérialiserait toutes les réponses de tous les candidats.
  it("verrouille la participation seule, propriété (exam_id, user_id) dans le WHERE", async () => {
    rows = [examRow()]
    await exam("answer")
    const query = (execute.mock.calls as unknown[][])[0]?.[0] as {
      queryChunks: unknown[]
    }
    const text = JSON.stringify(query.queryChunks)
    expect(text).toContain("user_id")
    expect(text).toMatch(/for update of p/i)
  })

  it("examen ou participation d'autrui introuvable → NOT_FOUND", async () => {
    rows = []
    expect(await exam("answer")).toEqual({ ok: false, code: "NOT_FOUND" })
  })

  it("participation déjà soumise → NOT_IN_PROGRESS", async () => {
    rows = [examRow({ status: "auto_submitted" })]
    expect(await exam("close")).toEqual({
      ok: false,
      code: "NOT_IN_PROGRESS",
    })
  })

  it("participation sans démarrage → NOT_STARTED", async () => {
    rows = [examRow({ started_at: null })]
    expect(await exam("flag")).toEqual({ ok: false, code: "NOT_STARTED" })
  })

  describe("fenêtre de l'examen (answer, close)", () => {
    it.each(["answer", "close"] as const)(
      "%s : avant la date de début → OUTSIDE_WINDOW",
      async (verb) => {
        rows = [examRow({ start_date: NOW + 1 })]
        expect(await exam(verb)).toEqual({
          ok: false,
          code: "OUTSIDE_WINDOW",
        })
      },
    )

    // Borne du glossaire (« examen ouvert » = date de fin non passée), la
    // même que le verrou de clé de réponse et que le cron de clôture.
    it("à l'instant exact de la fin, l'examen est clos", async () => {
      rows = [examRow({ end_date: NOW })]
      expect(await exam("answer")).toEqual({
        ok: false,
        code: "OUTSIDE_WINDOW",
      })
    })

    it("1 ms avant la fin, encore ouvert", async () => {
      rows = [examRow({ end_date: NOW + 1 })]
      expect((await exam("answer")).ok).toBe(true)
    })
  })

  describe("accès (answer, close)", () => {
    it.each(["answer", "close"] as const)(
      "%s : audience abonnés sans accès examen → ACCESS_EXPIRED",
      async (verb) => {
        rows = [examRow()]
        mocks.hasActiveAccess.mockResolvedValueOnce(false)
        expect(await exam(verb)).toEqual({
          ok: false,
          code: "ACCESS_EXPIRED",
        })
        expect(mocks.hasActiveAccess).toHaveBeenCalledWith(exec, {
          userId: "u1",
          type: "exam",
          now: NOW,
        })
      },
    )

    // Audience restreinte : la participation vaut autorisation.
    it("audience restreinte : aucun abonnement requis", async () => {
      rows = [examRow({ audience_type: "restricted" })]
      mocks.hasActiveAccess.mockResolvedValue(false)
      expect((await exam("answer")).ok).toBe(true)
      expect(mocks.hasActiveAccess).not.toHaveBeenCalled()
    })

    it("admin : aucun abonnement requis", async () => {
      rows = [examRow()]
      mocks.hasActiveAccess.mockResolvedValue(false)
      expect((await exam("close", { actor: admin })).ok).toBe(true)
      expect(mocks.hasActiveAccess).not.toHaveBeenCalled()
    })
  })

  describe("pause", () => {
    it("answer pendant la pause → PAUSED", async () => {
      rows = [examRow({ pause_started_at: NOW - 1_000 })]
      expect(await exam("answer")).toEqual({ ok: false, code: "PAUSED" })
    })

    it("close pendant la pause → autorisé, la pause en cours est portée par l'horloge", async () => {
      rows = [examRow({ pause_started_at: NOW - 1_000 })]
      const res = await exam("close")
      expect(res).toMatchObject({
        ok: true,
        attempt: {
          timing: {
            pauseInProgress: { startedAt: NOW - 1_000, capMinutes: 20 },
          },
        },
      })
    })

    it("plafond de pause absent → durée par défaut", async () => {
      rows = [
        examRow({
          pause_started_at: NOW - 1_000,
          pause_duration_minutes: null,
        }),
      ]
      expect(await exam("close")).toMatchObject({
        attempt: { timing: { pauseInProgress: { capMinutes: 15 } } },
      })
    })
  })

  describe("budget de temps", () => {
    // Budget 100 s + grâce 10 s : cas jumeaux à 1 ms près.
    const started = examRow({ started_at: 0 })
    const withinGrace = 110_000
    const pastGrace = 110_001

    it("answer dans la grâce → autorisé", async () => {
      rows = [started]
      expect((await exam("answer", { now: withinGrace })).ok).toBe(true)
    })

    it("answer 1 ms après la grâce → TIME_UP", async () => {
      rows = [started]
      expect(await exam("answer", { now: pastGrace })).toEqual({
        ok: false,
        code: "TIME_UP",
      })
    })

    it("le crédit de pause figé repousse la borne", async () => {
      rows = [examRow({ started_at: 0, total_pause_duration_ms: "1" })]
      expect((await exam("answer", { now: pastGrace })).ok).toBe(true)
    })

    it("close manuel après la grâce → TIME_UP", async () => {
      rows = [started]
      expect(await exam("close", { now: pastGrace })).toEqual({
        ok: false,
        code: "TIME_UP",
      })
    })

    // `isAutoSubmit` vient du client : il n'exempte que la clôture, jamais une
    // réponse (gardée par `answer`).
    it("close auto-soumis après la grâce → autorisé", async () => {
      rows = [started]
      expect(
        (await exam("close", { now: pastGrace, isAutoSubmit: true })).ok,
      ).toBe(true)
    })

    it("answer auto-soumis n'existe pas : le flag est ignoré", async () => {
      rows = [started]
      expect(
        await exam("answer", { now: pastGrace, isAutoSubmit: true }),
      ).toEqual({ ok: false, code: "TIME_UP" })
    })

    it.each(["answer", "close"] as const)(
      "%s : un admin n'est pas soumis au budget",
      async (verb) => {
        rows = [started]
        expect((await exam(verb, { now: pastGrace, actor: admin })).ok).toBe(
          true,
        )
      },
    )
  })

  // flag · pause · resume · abandon : ni fenêtre, ni accès, ni pause, ni budget.
  it.each(["flag", "pause", "resume", "abandon"] as const)(
    "%s : hors fenêtre, sans accès, en pause et hors budget → autorisé",
    async (verb) => {
      rows = [
        examRow({
          started_at: 0,
          end_date: NOW - 1,
          pause_started_at: NOW - 1_000,
        }),
      ]
      mocks.hasActiveAccess.mockResolvedValue(false)
      expect((await exam(verb, { now: NOW })).ok).toBe(true)
      expect(mocks.hasActiveAccess).not.toHaveBeenCalled()
    },
  )
})

describe("refusalMessage", () => {
  it("NOT_FOUND selon le type de tentative", () => {
    expect(refusalMessage("NOT_FOUND", "training")).toBe("Session introuvable")
    expect(refusalMessage("NOT_FOUND", "exam")).toBe(
      "Participation introuvable.",
    )
  })
})
