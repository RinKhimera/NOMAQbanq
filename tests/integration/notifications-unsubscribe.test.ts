import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/db"
import { user } from "@/db/schema"
import {
  resubscribeWithToken,
  unsubscribeWithToken,
} from "@/features/notifications/actions"
import { createId } from "@/lib/ids"
import { createUnsubscribeToken } from "@/lib/unsubscribe-token"

const uid = createId()
const deletedUid = createId()
const flag = async (id: string) =>
  (
    await db
      .select({ m: user.notifyMarketing })
      .from(user)
      .where(eq(user.id, id))
      .limit(1)
  )[0]?.m

beforeAll(async () => {
  await db.insert(user).values([
    { id: uid, name: "Désabo", email: `unsub-${uid}@test.invalid` },
    {
      id: deletedUid,
      name: "Supprimé",
      email: `del-${deletedUid}@test.invalid`,
      deletedAt: new Date(),
    },
  ])
})

afterAll(async () => {
  await db.delete(user).where(eq(user.id, uid))
  await db.delete(user).where(eq(user.id, deletedUid))
})

describe("désabonnement par jeton", () => {
  it("jeton valide : désactive, idempotent, réactive", async () => {
    const token = createUnsubscribeToken(uid)
    expect(await unsubscribeWithToken({ token })).toEqual({ success: true })
    expect(await flag(uid)).toBe(false)
    expect(await unsubscribeWithToken({ token })).toEqual({ success: true })
    expect(await resubscribeWithToken({ token })).toEqual({ success: true })
    expect(await flag(uid)).toBe(true)
  })

  it("jeton invalide ou compte supprimé : rien n'est écrit", async () => {
    expect((await unsubscribeWithToken({ token: "abc.def" })).success).toBe(
      false,
    )
    expect(
      (
        await unsubscribeWithToken({
          token: createUnsubscribeToken(deletedUid),
        })
      ).success,
    ).toBe(false)
    expect(await flag(uid)).toBe(true)
    expect(await flag(deletedUid)).toBe(true)
  })
})
