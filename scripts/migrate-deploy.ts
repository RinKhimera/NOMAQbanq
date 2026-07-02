/**
 * Applique les migrations Drizzle pendant le build Vercel de PRODUCTION
 * (gate `VERCEL_ENV === "production"` : no-op en local et sur les Previews —
 * la branche Neon de dev se migre à la main). Idempotent : drizzle-kit ne
 * rejoue jamais une migration déjà journalisée (`drizzle.__drizzle_migrations`).
 * Un échec de migration fait échouer le build → la prod reste sur l'ancien
 * couple code+schéma (état cohérent, pas de dérive).
 *
 * Lancé via `bun run build:vercel` (buildCommand de `vercel.json`).
 * Requiert `DATABASE_URL_UNPOOLED` dans l'env Production (cf. drizzle.config.ts).
 */
import { spawnSync } from "node:child_process"

const target = process.env.VERCEL_ENV ?? "local"

if (target !== "production") {
  console.log(`[migrate-deploy] env « ${target} » → migrations sautées.`)
  process.exit(0)
}

console.log("[migrate-deploy] build production → application des migrations…")
const result = spawnSync("bun", ["run", "db:migrate"], {
  stdio: "inherit",
  shell: true,
})
const status = result.status ?? 1

if (status !== 0) {
  console.error("[migrate-deploy] db:migrate a échoué — build interrompu.")
}
process.exit(status)
