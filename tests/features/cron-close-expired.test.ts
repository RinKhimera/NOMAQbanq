import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/cron/close-expired/route"
import { type CronTask, runSchedule } from "@/features/cron/run"

// Route cron : garde fail-closed, puis `runSchedule(SCHEDULE)` → 500 si une
// tâche a échoué, sinon le rapport JSON. L'ordre des vraies tâches se lit
// dans cron-schedule.test.ts ; le contenu de chaque tâche est testé chez elle.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    captureServerError: vi.fn(),
    env: { CRON_SECRET: "s3cret" as string | undefined },
    first: vi.fn(async () => ({ closedCount: 0 })),
    second: vi.fn(async () => ({ sent: 0 })),
  },
}))

vi.mock("@/features/cron/schedule", () => ({
  SCHEDULE: [
    { key: "first", label: "première", tag: "[cron:first]", run: mocks.first },
    {
      key: "second",
      label: "seconde",
      tag: "[cron:second]",
      run: mocks.second,
    },
  ],
}))
vi.mock("@/lib/env/server", () => ({ env: mocks.env }))
vi.mock("@/lib/observability", () => ({
  captureServerError: mocks.captureServerError,
}))

const call = (authorization?: string) =>
  GET(
    new Request("https://app.test/api/cron/close-expired", {
      headers: authorization ? { authorization } : {},
    }),
  )

beforeEach(() => {
  mocks.env.CRON_SECRET = "s3cret"
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "log").mockImplementation(() => {})
})

describe("garde d'authentification (fail-closed)", () => {
  it("secret non configure → 401, aucune tache lancee", async () => {
    mocks.env.CRON_SECRET = undefined
    const res = await call("Bearer s3cret")
    expect(res.status).toBe(401)
    expect(mocks.first).not.toHaveBeenCalled()
  })

  it("en-tete absent → 401", async () => {
    const res = await call()
    expect(res.status).toBe(401)
    expect(mocks.first).not.toHaveBeenCalled()
  })

  it("mauvais bearer → 401", async () => {
    const res = await call("Bearer autre")
    expect(res.status).toBe(401)
    expect(mocks.first).not.toHaveBeenCalled()
  })
})

describe("réponse de la route", () => {
  it("bearer valide → 200 et rapport indexé par clé de tâche", async () => {
    mocks.first.mockResolvedValueOnce({ closedCount: 2 })
    mocks.second.mockResolvedValueOnce({ sent: 3 })

    const res = await call("Bearer s3cret")
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      first: { closedCount: 2 },
      second: { sent: 3 },
    })
  })

  it("une tâche en échec → 500 après avoir tout tenté", async () => {
    mocks.first.mockRejectedValueOnce(new Error("poison row"))
    const res = await call("Bearer s3cret")
    expect(res.status).toBe(500)
    expect(mocks.second).toHaveBeenCalled()
  })
})

describe("runSchedule", () => {
  const task = (
    key: string,
    run: CronTask["run"],
    extra: Partial<CronTask> = {},
  ): CronTask => ({
    key,
    label: `tâche ${key}`,
    tag: `[cron:${key}]`,
    ...extra,
    run,
  })

  it("exécute les tâches en séquence et indexe le rapport par clé", async () => {
    const order: string[] = []
    const { report, failed } = await runSchedule([
      task("a", async () => {
        order.push("a")
        return { n: 1 }
      }),
      task("b", async () => {
        order.push("b")
        return { ok: true }
      }),
    ])
    expect(order).toEqual(["a", "b"])
    expect(failed).toBe(false)
    expect(report).toEqual({ a: { n: 1 }, b: { ok: true } })
  })

  // L'invariant central : sans isolation, un échec de la première tâche
  // empêcherait les suivantes (anonymisation RGPD) de tourner.
  it("une tâche qui lève n'empêche pas les suivantes ; capturée sous son tag et son libellé", async () => {
    const boom = new Error("poison row")
    const after = vi.fn(async () => ({ n: 4 }))
    const { report, failed } = await runSchedule([
      task("bad", async () => {
        throw boom
      }),
      task("after", after),
    ])
    expect(after).toHaveBeenCalled()
    expect(failed).toBe(true)
    expect(report).toEqual({ bad: {}, after: { n: 4 } })
    expect(mocks.captureServerError).toHaveBeenCalledWith("[cron:bad]", boom, {
      detail: "tâche bad",
    })
  })

  it("chaque échec est capturé sous son propre tag", async () => {
    await runSchedule([
      task("x", async () => {
        throw new Error("x")
      }),
      task("y", async () => ({ n: 0 })),
      task("z", async () => {
        throw new Error("z")
      }),
    ])
    expect(mocks.captureServerError.mock.calls.map((c) => c[0])).toEqual([
      "[cron:x]",
      "[cron:z]",
    ])
  })

  it("journal : seuls les compteurs non nuls, libellé=valeur ; rien si tout est à zéro", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})

    await runSchedule([
      task("a", async () => ({ closedCount: 0 })),
      task("b", async () => ({ sent: 0, failed: true })),
    ])
    expect(log).not.toHaveBeenCalled()

    await runSchedule([
      task("a", async () => ({ closedCount: 2 }), { label: "clôture examens" }),
      task("b", async () => ({ sent: 0, reminders: 3, failed: true }), {
        label: "notifications",
      }),
      task("c", async () => ({ checked: 5 }), { quiet: true }),
    ])
    expect(log).toHaveBeenCalledTimes(1)
    const line = String(log.mock.calls[0]?.[0])
    expect(line).toContain("clôture examens closedCount=2")
    expect(line).toContain("notifications reminders=3")
    expect(line).not.toContain("sent=")
    expect(line).not.toContain("failed")
    expect(line).not.toContain("checked")
  })

  // Une jauge non nulle à chaque passage rendrait le journal bavard.
  it("journal : une tâche `quiet` ne parle jamais, même non nulle", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    await runSchedule([
      task("c", async () => ({ checked: 5 }), { quiet: true }),
    ])
    expect(log).not.toHaveBeenCalled()
  })
})
