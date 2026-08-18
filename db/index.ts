import { attachDatabasePool } from "@vercel/functions"
import { drizzle } from "drizzle-orm/node-postgres"
import { env } from "@/lib/env/server"
import { NeonRetryPool } from "./retry-pool"
import * as schema from "./schema"

// One pool created at module scope, reused across requests (Vercel Fluid Compute).
// Use the POOLED (-pooler) connection string for the runtime.
// connectionTimeoutMillis borne l'acquisition (réveil Neon lent, file du pool
// saturé) : erreur franche à 10 s au lieu d'un blocage indéfini.
const pool = new NeonRetryPool({
  connectionString: env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10_000,
})

// Sans listener, une connexion idle coupée par Neon (reprise d'instance, reset
// réseau) émet `error` sur le pool → uncaughtException fatale. Le pool remplace
// le client mort tout seul ; il n'y a rien d'autre à faire que ne pas crasher.
pool.on("error", (err) => {
  // err.code (57P01, ECONNRESET…) est le seul discriminant entre coupure
  // bénigne et problème émergent sur le canal logs Vercel.
  const code = (err as NodeJS.ErrnoException).code ?? "sans-code"
  console.warn("[pg pool] connexion idle perdue", code, err.message)
})

// On Vercel, let the runtime drain idle connections before suspending an instance.
if (process.env.VERCEL) attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
export type Db = typeof db
