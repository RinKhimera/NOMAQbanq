import { defineConfig } from "vitest/config"
import baseConfig from "./vitest.config"

// `coverage` n'est PAS configurable par projet (NonProjectOptions) : un seul perimetre
// vaut pour tout un run. D'ou cette config dediee, qui elargit l'`include` au backend et
// se lance sur les DEUX projets a la fois — seule facon d'obtenir un chiffre unique
// couvrant frontend et backend, puisque des tests du projet `frontend`
// (tests/features/**) exercent du code backend sans base de donnees.
// Lancee par `bun run test:coverage:full` (via l'orchestrateur Neon).
const baseCoverage = baseConfig.test?.coverage as
  { exclude?: string[] } | undefined

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    coverage: {
      provider: "v8",
      include: [
        "lib/**/*.ts",
        "hooks/**/*.ts",
        "components/**/*.tsx",
        "schemas/**/*.ts",
        "email/**/*.{ts,tsx}",
        "features/**/*.ts",
        "app/api/**/*.ts",
      ],
      exclude: [
        ...(baseCoverage?.exclude ?? []),
        // Harnais de support des tests e2e, pas du code de production.
        "app/api/e2e/**",
      ],
      reporter: ["text", "json"],
      // Cales sous la mesure de cloture du 2026-08-05 (88,22 / 81,73 / 86,27 /
      // 89,28) : un seuil sert a empecher le retour en arriere, pas a decrire
      // l'ambition. Les quatre metriques tiennent desormais la politique maison
      // de 80 % ; `branches` garde ~54 branches de marge.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
