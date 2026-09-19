import { and, eq, inArray } from "drizzle-orm"
import { afterAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { user } from "@/db/schema"
import {
  type OneShotSpec,
  eligibleRecipient,
  sendOnce,
} from "@/features/notifications/one-shot"
import { createId } from "@/lib/ids"

const capture = vi.hoisted(() => vi.fn())
vi.mock("@/lib/observability", () => ({ captureServerError: capture }))

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-09-18T12:00:00.000Z")
const suffix = createId().slice(0, 8)

type Row = { id: string; userId: string; email: string; name: string }

const seeded: string[] = []
const newUser = async (
  extra: Partial<typeof user.$inferInsert> = {},
): Promise<string> => {
  const id = createId()
  await db.insert(user).values({
    id,
    name: `OneShot ${id.slice(0, 6)}`,
    email: `oneshot-${id.slice(0, 6)}-${suffix}@test.invalid`,
    ...extra,
  })
  seeded.push(id)
  return id
}

const marker = async (id: string) =>
  (
    await db
      .select({ v: user.welcomeEmailSentAt })
      .from(user)
      .where(eq(user.id, id))
      .limit(1)
  )[0]?.v ?? null

/** Sélection SANS filtre d'éligibilité : c'est le claim qui doit garantir. */
const selectUsers = (ids: string[]) => () =>
  db
    .select({
      id: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
    })
    .from(user)
    .where(inArray(user.id, ids))
    .orderBy(user.id)

const spec = (
  ids: string[],
  over: Partial<OneShotSpec<Row>> = {},
): OneShotSpec<Row> => ({
  label: "test",
  tag: "[notif:test]",
  limit: 100,
  now: NOW,
  select: selectUsers(ids),
  claim: {
    table: user,
    idColumn: user.id,
    markerColumn: user.welcomeEmailSentAt,
  },
  send: vi.fn().mockResolvedValue("msg-id"),
  context: (row) => ({ userId: row.userId }),
  ...over,
})

afterAll(async () => {
  await db.delete(user).where(inArray(user.id, seeded))
})

describe("sendOnce — le courriel unique part une fois", () => {
  it("deux runs concurrents sur le même lot : chaque ligne envoyée une fois, marqueur posé une fois", async () => {
    const ids = [await newUser(), await newUser(), await newUser()]
    const send = vi.fn().mockResolvedValue("id")
    const s = spec(ids, { send })

    const [a, b] = await Promise.all([sendOnce(s), sendOnce(s)])

    expect(a + b).toBe(3)
    expect(send).toHaveBeenCalledTimes(3)
    expect(new Set(send.mock.calls.map((c) => (c[0] as Row).id)).size).toBe(3)
    for (const id of ids) expect(await marker(id)).toEqual(NOW)
  })

  it("rejeu après claim : 0 envoi, marqueur inchangé", async () => {
    const id = await newUser()
    const send = vi.fn().mockResolvedValue("id")
    expect(await sendOnce(spec([id], { send }))).toBe(1)
    expect(await sendOnce(spec([id], { send }))).toBe(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(await marker(id)).toEqual(NOW)
  })
})

describe("sendOnce — destinataire éligible (garanti par le claim)", () => {
  it.each([
    ["suspendu", { banned: true, banReason: "test" }],
    ["supprimé", { deletedAt: new Date(NOW.getTime() - DAY) }],
  ] as const)(
    "compte %s renvoyé par un select sans filtre : aucun envoi, aucun marqueur",
    async (_name, extra) => {
      const id = await newUser(extra)
      const send = vi.fn().mockResolvedValue("id")

      expect(await sendOnce(spec([id], { send }))).toBe(0)

      expect(send).not.toHaveBeenCalled()
      expect(await marker(id)).toBeNull()
    },
  )

  // READ COMMITTED : un UPDATE qui a attendu un verrou de ligne ré-évalue ses
  // prédicats sur la version fraîche de la LIGNE CIBLE seulement ; un sous-select
  // resterait au snapshot de départ (banned = false) et laisserait passer.
  it("suspension commitée pendant l'attente du verrou de ligne : aucun envoi, aucun marqueur", async () => {
    const id = await newUser()
    const send = vi.fn().mockResolvedValue("id")
    const suspension = db.transaction(async (tx) => {
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, id))
        .for("update")
      await tx
        .update(user)
        .set({ banned: true, banReason: "test" })
        .where(eq(user.id, id))
      await new Promise((r) => setTimeout(r, 1500))
    })
    await new Promise((r) => setTimeout(r, 300))

    const sent = await sendOnce(spec([id], { send }))
    await suspension

    expect(sent).toBe(0)
    expect(send).not.toHaveBeenCalled()
    expect(await marker(id)).toBeNull()
  })

  it("eligibleRecipient dans un select exclut suspendus et supprimés", async () => {
    const ok = await newUser()
    const banned = await newUser({ banned: true, banReason: "test" })
    const deleted = await newUser({ deletedAt: NOW })
    const rows = await db
      .select({ id: user.id })
      .from(user)
      .where(and(inArray(user.id, [ok, banned, deleted]), eligibleRecipient))
    expect(rows.map((r) => r.id)).toEqual([ok])
  })
})

describe("sendOnce — échec d'envoi", () => {
  it("send rejette : marqueur posé, erreur capturée avec tag et contexte, non compté, lignes suivantes traitées", async () => {
    const ids = [await newUser(), await newUser()]
    const boom = new Error("SES down")
    const send = vi
      .fn()
      .mockImplementation(async (row: Row) =>
        row.id === ids[0] ? Promise.reject(boom) : "id",
      )

    expect(await sendOnce(spec(ids, { send }))).toBe(1)

    expect(send).toHaveBeenCalledTimes(2)
    expect(await marker(ids[0])).toEqual(NOW)
    expect(await marker(ids[1])).toEqual(NOW)
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith("[notif:test]", boom, {
      userId: ids[0],
    })
  })
})

describe("sendOnce — shouldSend après le claim", () => {
  it("faux : marqueur posé, pas d'envoi, non compté", async () => {
    const id = await newUser()
    const send = vi.fn().mockResolvedValue("id")

    expect(await sendOnce(spec([id], { send, shouldSend: () => false }))).toBe(
      0,
    )

    expect(send).not.toHaveBeenCalled()
    expect(await marker(id)).toEqual(NOW)
  })
})

describe("sendOnce — plafond (cooldownMs)", () => {
  const cooldown = 7 * DAY
  it.each([
    ["marqueur absent", null, true],
    [
      "marqueur plus vieux que le plafond",
      new Date(NOW.getTime() - 8 * DAY),
      true,
    ],
    [
      "marqueur plus jeune que le plafond",
      new Date(NOW.getTime() - 6 * DAY),
      false,
    ],
  ] as const)("%s → claimé : %s", async (_name, existing, claimed) => {
    const id = await newUser({ welcomeEmailSentAt: existing })
    const send = vi.fn().mockResolvedValue("id")

    const sent = await sendOnce(
      spec([id], {
        send,
        claim: {
          table: user,
          idColumn: user.id,
          markerColumn: user.welcomeEmailSentAt,
          cooldownMs: cooldown,
        },
      }),
    )

    expect(sent).toBe(claimed ? 1 : 0)
    expect(await marker(id)).toEqual(claimed ? NOW : existing)
  })
})

describe("sendOnce — guard", () => {
  it.each([
    ["garde vraie (valeur lue inchangée)", true],
    ["garde fausse (ligne modifiée depuis la lecture)", false],
  ])("%s → claimé : %s", async (_name, claimed) => {
    const id = await newUser()
    const send = vi.fn().mockResolvedValue("id")

    const sent = await sendOnce(
      spec([id], {
        send,
        claim: {
          table: user,
          idColumn: user.id,
          markerColumn: user.welcomeEmailSentAt,
          guard: (row) => eq(user.name, claimed ? row.name : "autre nom"),
        },
      }),
    )

    expect(sent).toBe(claimed ? 1 : 0)
    expect(await marker(id)).toEqual(claimed ? NOW : null)
  })
})

describe("sendOnce — borne et erreur de lecture", () => {
  it("borne atteinte → avertissement en console, lot traité", async () => {
    const ids = [await newUser(), await newUser()]
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    expect(await sendOnce(spec(ids, { limit: 2, label: "lot" }))).toBe(2)

    expect(warn).toHaveBeenCalledWith(
      "[notif] lot — borne 2 atteinte : le reste sera traité au prochain run",
    )
  })

  it("sous la borne → aucun avertissement", async () => {
    const ids = [await newUser()]
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await sendOnce(spec(ids, { limit: 2, label: "lot" }))

    expect(warn).not.toHaveBeenCalled()
  })

  it("erreur du select → propagée à l'appelant, rien capturé", async () => {
    const boom = new Error("Neon down")
    await expect(
      sendOnce(spec([], { select: () => Promise.reject(boom) })),
    ).rejects.toBe(boom)
    expect(capture).not.toHaveBeenCalled()
  })
})
