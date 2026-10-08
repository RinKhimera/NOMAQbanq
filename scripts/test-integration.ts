/**
 * Orchestrateur des tests d'intégration : Postgres jetable (Docker) → migrations
 * → vitest (projet integration, une base par worker) → destruction garantie.
 * Flag --keep pour garder le conteneur en debug (ramassé par le ménage > 1 h).
 * Lancer via `bun run test:integration` (ou `bun scripts/test-integration.ts --keep`).
 */
import { spawnSync } from "node:child_process"
import {
  removeStaleTestContainers,
  startTestPostgres,
  stopTestPostgres,
} from "./test-postgres"

const keep = process.argv.includes("--keep")

// Tout le reste part à vitest : sans ça, `bun run test:integration -- <fichier>`
// exécutait silencieusement la suite entière.
const vitestArgs = process.argv
  .slice(2)
  .filter((arg) => arg !== "--keep" && arg !== "--")

// Ctrl+C atteint aussi vitest, qui s'arrête de lui-même. Ignoré ici, le signal
// ne tue plus l'orchestrateur avant son `finally` : `spawnSync` rend la main
// et le conteneur est supprimé.
process.on("SIGINT", () => {})
process.on("SIGTERM", () => {})

const removed = removeStaleTestContainers()
if (removed.length > 0) {
  console.log(
    `[test-integration] conteneurs orphelins supprimés : ${removed.join(", ")}`,
  )
}

console.log("[test-integration] démarrage de Postgres…")
const postgres = await startTestPostgres()
console.log(`[test-integration] ${postgres.name} prêt (${postgres.url})`)

const run = (command: string, args: string[], env: NodeJS.ProcessEnv): number =>
  spawnSync(command, args, { env, stdio: "inherit", shell: true }).status ?? 1

let exitCode = 1
try {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: postgres.url,
    DATABASE_URL_UNPOOLED: postgres.url,
    INTEGRATION_CONTAINER: postgres.name,
  }

  console.log("[test-integration] migrations…")
  if (run("bun", ["run", "db:migrate"], env) !== 0) {
    throw new Error("db:migrate a échoué sur la base de test.")
  }

  console.log("[test-integration] tests…")
  // `--project` explicite (couverture complète : frontend + integration) prime sur
  // le ciblage par défaut, sinon les deux se cumuleraient.
  const projectArgs = vitestArgs.includes("--project")
    ? []
    : ["--project", "integration"]
  exitCode = run("bunx", ["vitest", "run", ...projectArgs, ...vitestArgs], env)
} finally {
  if (keep) {
    console.log(
      `[test-integration] --keep : conteneur conservé → ${postgres.name} (${postgres.url})`,
    )
  } else {
    stopTestPostgres(postgres.name)
    console.log("[test-integration] conteneur supprimé.")
  }
}

process.exit(exitCode)
