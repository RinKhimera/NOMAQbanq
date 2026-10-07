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

// Intégration : fichiers qui ne supportent pas d'autres fichiers en parallèle
// sur la même branche Neon. Un balayage (cron, `ALTER TABLE`) touche les
// fixtures des autres ; un écart avant/après sur un agrégat global (comptes,
// revenus, examens disponibles) compte leurs insertions ; `pg_stat_activity`
// voit leurs attentes de verrou ; un produit cherché par son code
// (`createStripeCheckout`, `recordManualPayment`) peut être celui d'un autre
// fichier, le code n'étant pas unique. Un nouveau fichier de l'un de ces types
// s'ajoute ici.
const SERIAL_INTEGRATION = [
  // Balayages
  "cmc-objectives",
  "cron-close-expired",
  "exam-preparation",
  "notifications-cron",
  "training-concurrency",
  "users-account",
  "users-ban",
  // Agrégats globaux
  "admin-dashboard-dal",
  "exam-composer",
  "marketing-dal",
  "payments-admin-dal",
  "payments-clients-dal",
  "payments-stripe",
  "questions-dal",
  "student-dashboard-dal",
  "users-admin-dal",
  // Attentes de verrou comptées sur toute la base
  "payments-actions",
  // Produit cherché par son code
  "payments-checkout",
  "payments-manual",
  "payments-verify",
].map((name) => `tests/integration/${name}.test.ts`)

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
    // Vitest laisse ces quatre options a `false` : sans elles, l'historique d'appels
    // et les implementations simulees survivent d'un test au suivant dans un meme
    // fichier — un `toHaveBeenCalledTimes` peut alors passer grace au test precedent.
    // Elles ne couvrent PAS les faux timers : `restoreAllMocks` ne parcourt que le
    // registre des espions (@vitest/spy), donc un `vi.useFakeTimers()` reste actif
    // pour les tests suivants — l'`afterEach(() => vi.useRealTimers())` reste requis.
    clearMocks: true,
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
    projects: [
      {
        extends: true,
        test: {
          name: "frontend",
          environment: "happy-dom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: ["tests/integration/**"],
        },
      },
      {
        // Tests d'intégration DAL/Actions contre une vraie branche Neon jetable.
        // Opt-in : lancés UNIQUEMENT via `bun run test:integration` (orchestrateur
        // qui crée la branche + pose INTEGRATION_BRANCH/HOST). Exclus de `bun run test`.
        // Fichiers en parallèle : chacun ne lit que ses propres fixtures.
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          exclude: SERIAL_INTEGRATION,
          setupFiles: ["./vitest.setup.integration.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        // Un fichier à la fois, après tous les autres (`groupOrder`) : ces
        // fichiers balaient toute la branche ou mesurent un agrégat global.
        extends: true,
        test: {
          name: "integration-serial",
          environment: "node",
          include: SERIAL_INTEGRATION,
          setupFiles: ["./vitest.setup.integration.ts"],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
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
