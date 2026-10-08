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

// Le projet `integration` mélange l'ordre des tests ; vitest n'affiche pas la
// graine qu'il tire. Tirée ici et affichée, elle rend un échec rejouable.
const seedIndex = vitestArgs.findIndex((arg) =>
  arg.startsWith("--sequence.seed"),
)
const seed =
  seedIndex === -1
    ? String(Math.floor(Math.random() * 1e6))
    : (vitestArgs[seedIndex].split("=")[1] ?? vitestArgs[seedIndex + 1])
if (seedIndex === -1) vitestArgs.push(`--sequence.seed=${seed}`)

// Ctrl+C atteint aussi vitest, qui s'arrête de lui-même. Ignoré ici :
// l'orchestrateur survit au signal, `spawnSync` rend la main et le `finally`
// supprime le conteneur.
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

// Sans shell : un shell redécouperait `-t "deux fois"` aux espaces et, sous
// Windows, abîmerait les accents — le filtre ciblerait d'autres tests sans
// erreur. L'exécutable de bun courant évite d'avoir à résoudre `bun.cmd`.
const run = (args: string[], env: NodeJS.ProcessEnv): number =>
  spawnSync(process.execPath, args, { env, stdio: "inherit" }).status ?? 1

let exitCode = 1
try {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: postgres.url,
    DATABASE_URL_UNPOOLED: postgres.url,
    INTEGRATION_CONTAINER: postgres.name,
  }

  console.log("[test-integration] migrations…")
  if (run(["run", "db:migrate"], env) !== 0) {
    throw new Error("db:migrate a échoué sur la base de test.")
  }

  console.log(
    `[test-integration] tests… (ordre : graine ${seed}, rejouer avec -- --sequence.seed=${seed})`,
  )
  // `--project` explicite (couverture complète : frontend + integration) prime sur
  // le ciblage par défaut, sinon les deux se cumuleraient.
  const projectArgs = vitestArgs.includes("--project")
    ? []
    : ["--project", "integration"]
  exitCode = run(["x", "vitest", "run", ...projectArgs, ...vitestArgs], env)
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
