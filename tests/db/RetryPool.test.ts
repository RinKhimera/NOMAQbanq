import { Pool } from "pg"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NeonRetryPool, isNeonWakeupError } from "@/db/retry-pool"

const pgError = (code: string) =>
  Object.assign(new Error(`pg ${code}`), { code })

// Client minimal : seule `release` est consommée par pg-pool/drizzle.
const fakeClient = () => ({ release: vi.fn() }) as never

const makePool = () =>
  new NeonRetryPool(
    { connectionString: "postgres://test@localhost/test" },
    { backoffsMs: [0, 0] },
  )

afterEach(() => vi.restoreAllMocks())

describe("isNeonWakeupError", () => {
  it("reconnaît 53300 et 57P03, refuse le reste", () => {
    expect(isNeonWakeupError(pgError("53300"))).toBe(true)
    expect(isNeonWakeupError(pgError("57P03"))).toBe(true)
    expect(isNeonWakeupError(pgError("28P01"))).toBe(false)
    expect(isNeonWakeupError(new Error("timeout exceeded"))).toBe(false)
    expect(isNeonWakeupError(null)).toBe(false)
  })
})

describe("NeonRetryPool", () => {
  it("réussit au 3e essai quand Neon refuse deux permits", async () => {
    const client = fakeClient()
    const spy = vi
      .spyOn(Pool.prototype, "connect")
      .mockRejectedValueOnce(pgError("53300"))
      .mockRejectedValueOnce(pgError("53300"))
      .mockResolvedValueOnce(client)

    await expect(makePool().connect()).resolves.toBe(client)
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it("abandonne après épuisement des retries", async () => {
    const spy = vi
      .spyOn(Pool.prototype, "connect")
      .mockRejectedValue(pgError("53300"))

    await expect(makePool().connect()).rejects.toMatchObject({ code: "53300" })
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it("ne retente pas une erreur étrangère au réveil", async () => {
    const spy = vi
      .spyOn(Pool.prototype, "connect")
      .mockRejectedValue(pgError("28P01"))

    await expect(makePool().connect()).rejects.toMatchObject({ code: "28P01" })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("retente aussi 57P03 (database system is starting up)", async () => {
    const client = fakeClient()
    vi.spyOn(Pool.prototype, "connect")
      .mockRejectedValueOnce(pgError("57P03"))
      .mockResolvedValueOnce(client)

    await expect(makePool().connect()).resolves.toBe(client)
  })

  it("préserve le contrat callback de pg-pool après un retry", async () => {
    const client: { release: ReturnType<typeof vi.fn> } = { release: vi.fn() }
    vi.spyOn(Pool.prototype, "connect")
      .mockRejectedValueOnce(pgError("53300"))
      .mockResolvedValueOnce(client as never)

    const cb = vi.fn()
    makePool().connect(cb)

    await vi.waitFor(() =>
      expect(cb).toHaveBeenCalledWith(undefined, client, client.release),
    )
  })

  it("propage l'échec à la forme callback", async () => {
    vi.spyOn(Pool.prototype, "connect").mockRejectedValue(pgError("53300"))

    const cb = vi.fn()
    makePool().connect(cb)

    await vi.waitFor(() =>
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ code: "53300" }),
      ),
    )
  })
})
