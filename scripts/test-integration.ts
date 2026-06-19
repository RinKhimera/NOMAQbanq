/**
 * Orchestrateur des tests d'intégration : branche Neon jetable → migrations →
 * vitest (projet integration) → destruction garantie. Flag --keep pour garder la
 * branche en debug (ramassée par le housekeeping > 1 h). Lancer via
 * `bun run test:integration` (ou `bun scripts/test-integration.ts --keep`).
 */
import { spawnSync } from "node:child_process"

import { config } from "dotenv"

import { cleanupStaleTestBranches, createTestBranch, deleteBranch } from "./neon-api"

config({ path: ".env.local" })

const keep = process.argv.includes("--keep")

const removed = await cleanupStaleTestBranches()
if (removed.length > 0) {
  console.log(`[test-integration] branches orphelines supprimées : ${removed.join(", ")}`)
}

console.log("[test-integration] création de la branche de test…")
const branch = await createTestBranch()
console.log(`[test-integration] branche ${branch.name} prête (${branch.host})`)

const run = (command: string, args: string[], env: NodeJS.ProcessEnv): number =>
  spawnSync(command, args, { env, stdio: "inherit", shell: true }).status ?? 1

let exitCode = 1
try {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: branch.connectionUri,
    DATABASE_URL_UNPOOLED: branch.connectionUri,
    INTEGRATION_BRANCH: branch.name,
    INTEGRATION_HOST: branch.host,
  }

  console.log("[test-integration] migrations…")
  if (run("bun", ["run", "db:migrate"], env) !== 0) {
    throw new Error("db:migrate a échoué sur la branche de test.")
  }

  console.log("[test-integration] tests…")
  exitCode = run("bunx", ["vitest", "run", "--project", "integration"], env)
} finally {
  if (keep) {
    console.log(`[test-integration] --keep : branche conservée → ${branch.name} (${branch.host})`)
  } else {
    await deleteBranch(branch.id)
    console.log("[test-integration] branche supprimée.")
  }
}

process.exit(exitCode)
