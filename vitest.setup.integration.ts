import { applyTestEnvDefaults } from "./tests/helpers/test-env"

// Triple garde-fou : ces tests ÉCRIVENT dans une vraie DB — jamais ailleurs que sur
// une branche Neon jetable `test-*`. Vérifié AVANT applyTestEnvDefaults pour lire
// l'URL réellement transmise par l'orchestrateur.
const branch = process.env.INTEGRATION_BRANCH
const host = process.env.INTEGRATION_HOST
const databaseUrl = process.env.DATABASE_URL ?? ""

if (!branch || !host) {
  throw new Error(
    "Tests d'intégration : lancez `bun run test:integration` (orchestrateur Neon), jamais vitest directement.",
  )
}
if (!branch.startsWith("test-")) {
  throw new Error(
    `Tests d'intégration : branche « ${branch} » refusée (préfixe test- requis).`,
  )
}
if (!databaseUrl.includes(host)) {
  throw new Error(
    "Tests d'intégration : DATABASE_URL ne pointe pas vers la branche de test attendue.",
  )
}

applyTestEnvDefaults()
