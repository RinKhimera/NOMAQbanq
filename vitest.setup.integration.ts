import { TEST_DATABASE } from "./scripts/test-postgres"
import { applyTestEnvDefaults } from "./tests/helpers/test-env"
import { cloneTestDatabase } from "./tests/helpers/worker-database"

// Triple garde-fou : ces tests ÉCRIVENT dans une vraie DB — jamais ailleurs que
// dans le Postgres jetable de l'orchestrateur. Develop et la prod ne sont jamais
// sur la boucle locale. Vérifié AVANT applyTestEnvDefaults pour lire l'URL
// réellement transmise par l'orchestrateur.
const container = process.env.INTEGRATION_CONTAINER
const databaseUrl = URL.parse(process.env.DATABASE_URL ?? "")

if (!container) {
  throw new Error(
    "Tests d'intégration : lancez `bun run test:integration` (orchestrateur Docker), jamais vitest directement.",
  )
}
if (
  !databaseUrl ||
  !["localhost", "127.0.0.1"].includes(databaseUrl.hostname)
) {
  throw new Error(
    "Tests d'intégration : DATABASE_URL doit pointer vers localhost (Postgres de test).",
  )
}
if (!databaseUrl.pathname.startsWith(`/${TEST_DATABASE}`)) {
  throw new Error(
    `Tests d'intégration : base « ${databaseUrl.pathname.slice(1)} » refusée (préfixe ${TEST_DATABASE} requis).`,
  )
}

const fileUrl = await cloneTestDatabase(databaseUrl)
process.env.DATABASE_URL = fileUrl
process.env.DATABASE_URL_UNPOOLED = fileUrl

applyTestEnvDefaults()

// Import différé : `@/db` lit l'environnement au chargement.
const { seedTestObjective } = await import("./tests/helpers/objective")
await seedTestObjective()
