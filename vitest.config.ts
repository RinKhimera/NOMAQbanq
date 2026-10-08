import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { realpathSync } from "fs"
import path from "path"
import { defineConfig } from "vitest/config"

// Sur Windows, process.cwd() garde la casse "logique" du dossier tel qu'il a ete
// ouvert (ex. NOMAqBANK), alors que Node/V8 rapporte la casse REELLE du disque
// (nomaqbank) dans les URLs de modules. La couverture v8 compare ces URLs a
// config.root de facon sensible a la casse : si elles different, tous les
// resultats sont juges "externes" et rejetes -> 0% partout (Windows uniquement ;
// la CI Linux n'est pas affectee). On force la casse reelle du disque.
const root = realpathSync.native(path.resolve(__dirname))

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  css: {
    // Désactiver le PostCSS config externe pour Vitest
    // Le plugin @tailwindcss/vite gère Tailwind directement
    postcss: {},
  },
  test: {
    env: { TZ: "UTC" },
    globals: true,
    // Vitest laisse ces options a `false` : sans elles, l'historique d'appels et
    // les implementations simulees survivent d'un test au suivant dans un meme
    // fichier — un `toHaveBeenCalledTimes` peut alors passer grace au test precedent.
    // `mockReset` vide aussi les files `*Once` et ramene un `vi.fn(impl)` a `impl` :
    // une implementation par defaut se pose donc par `vi.fn(impl)` ou dans un
    // `beforeEach`, jamais par un `mockImplementation` au chargement du fichier.
    // Aucune ne rend l'horloge : `vitest.setup.common.ts` remet les vrais timers.
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: [
        "lib/**/*.ts",
        "hooks/**/*.ts",
        "components/**/*.{ts,tsx}",
        "schemas/**/*.ts",
        "email/**/*.{ts,tsx}",
      ],
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "**/*.config.*",
        "**/*.d.ts",
        "components/ui/**",
        "app/**/layout.tsx",
        "app/**/page.tsx",
        "app/**/error.tsx",
        "app/**/not-found.tsx",
        "tests/**",
        "lib/auth.ts",
        // Infra server-only (I/O) : couverte par les tests d'integration
        // (uploads/stripe/rate-limit) ou config triviale ; non testable en
        // happy-dom.
        "lib/aws.ts",
        "lib/stripe.ts",
        "lib/upload-rate-limit.ts",
        "lib/quiz-rate-limit.ts",
        "lib/auth-guards.ts",
        "lib/dal.ts",
        "lib/auth-client.ts",
        "lib/env/server.ts",
        // Recadrage image : canvas/Image natifs non rendus par happy-dom.
        "lib/crop-image.ts",
        // Layout/Navigation (pas de logique metier)
        "components/shared/footer.tsx",
        "components/shared/marketing-shell.tsx",
        "components/shared/theme-toggle.tsx",
        "components/theme-provider.tsx",
        "components/marketing-header/**",
        // Legal (contenu statique)
        "components/shared/legal-*.tsx",
        // SEO (generation triviale)
        "components/seo/**",
        // Squelettes
        "components/admin/admin-list-skeleton.tsx",
        "components/quiz/session/passation-skeleton.tsx",
        "app/(dashboard)/tableau-de-bord/paiement/_components/payment-status-skeleton.tsx",
        // Upload CDN-heavy
        "components/shared/avatar-uploader.tsx",
        "components/admin/question-image-uploader.tsx",
        // Marketing (display pur)
        "components/marketing/**",
        // Modals/forms lourds
        "components/admin/user-multi-select.tsx",
        // Quiz tools (complex UI, low logic)
        "components/quiz/calculator/**",
        "components/quiz/lab-values/**",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    // L'extension choisit l'environnement : un `.test.ts` tourne sous Node, sans
    // DOM ni jest-dom (moitie de la suite, trois fois plus rapide) ; un test qui
    // rend un composant, un hook ou touche `document` est un `.test.tsx`. Un test
    // DOM laisse en `.ts` echoue aussitot (« document is not defined »).
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          setupFiles: ["./vitest.setup.common.ts"],
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/integration/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "frontend",
          environment: "happy-dom",
          setupFiles: ["./vitest.setup.common.ts", "./vitest.setup.ts"],
          include: ["tests/**/*.test.tsx"],
          exclude: ["tests/integration/**"],
        },
      },
      {
        // Tests d'intégration DAL/Actions contre un vrai Postgres jetable (Docker).
        // Opt-in : lancés UNIQUEMENT via `bun run test:integration` (orchestrateur
        // qui démarre le conteneur + pose INTEGRATION_CONTAINER). Exclus de `bun run test`.
        // Fichiers en parallèle, chaque worker sur sa propre base
        // (`tests/helpers/worker-database.ts`). Ordre des tests mélangé à chaque
        // run : un test qui compte sur l'état laissé par un autre finit par
        // rougir ; `--sequence.seed=<n>` rejoue l'ordre d'un échec.
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          // Les mocks de session y sont poses en `beforeAll` (la base se seme une
          // fois par fichier) : un `mockReset` avant chaque test les effacerait.
          mockReset: false,
          clearMocks: true,
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: [
            "./vitest.setup.common.ts",
            "./vitest.setup.integration.ts",
          ],
          sequence: { shuffle: { files: false, tests: true } },
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": root,
      // `server-only` lève hors RSC → stub en environnement de test.
      "server-only": path.resolve(root, "tests/helpers/server-only-stub.ts"),
    },
  },
})
