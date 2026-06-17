import { attachDatabasePool } from "@vercel/functions"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "@/lib/env/server"
import * as schema from "./schema"

// One pool created at module scope, reused across requests (Vercel Fluid Compute).
// Use the POOLED (-pooler) connection string for the runtime.
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 })

// On Vercel, let the runtime drain idle connections before suspending an instance.
if (process.env.VERCEL) attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
export type Db = typeof db
