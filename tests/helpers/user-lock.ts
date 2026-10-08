import { sql } from "drizzle-orm"
import { db } from "@/db"
import { lockUser } from "@/features/payments/access-ledger"

/**
 * Tient le verrou `user` dans une transaction à part. Les actions lancées
 * pendant ce temps lisent la transaction PUIS attendent derrière ce verrou :
 * l'entrelacement « deux lectures avant le premier commit » est forcé au lieu
 * d'être laissé au hasard du pool.
 */
export const holdUserLock = async (userId: string) => {
  let release!: () => void
  const released = new Promise<void>((r) => (release = r))
  let locked!: () => void
  const isLocked = new Promise<void>((r) => (locked = r))
  const holder = db.transaction(async (tx) => {
    await lockUser(tx, userId)
    locked()
    await released
  })
  // Course avec `holder` : un `lockUser` qui lève fait échouer le test au lieu
  // de l'endormir jusqu'au timeout.
  await Promise.race([isLocked, holder])

  return {
    /** Attend que `n` connexions soient bloquées sur un verrou. */
    waitForWaiters: async (n: number) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const res = await db.execute(sql`
          select count(*)::int as n from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock'
        `)
        if ((res.rows[0] as { n: number }).n >= n) return
        await new Promise((r) => setTimeout(r, 25))
      }
      throw new Error(`${n} attente(s) de verrou jamais observée(s)`)
    },
    release: async () => {
      release()
      await holder
    },
  }
}
