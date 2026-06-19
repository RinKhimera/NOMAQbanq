// Valeurs factices : permettent à tout module important @/lib/env/server de se
// valider pendant les tests sans dépendre du .env réel. `??=` : ne remplace jamais
// une valeur déjà présente (ex. DATABASE_URL posée par l'orchestrateur d'intégration).
const TEST_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://u:p@localhost/test",
  DATABASE_URL_UNPOOLED: "postgresql://u:p@localhost/test",
  // BETTER_AUTH_SECRET : >= 32 caractères (contrainte env, review N3).
  BETTER_AUTH_SECRET: "test-secret-please-change-000000000000",
  BETTER_AUTH_URL: "http://localhost:3000",
}

export const applyTestEnvDefaults = (): void => {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] ??= value
  }
}
