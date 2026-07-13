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
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: [
        "lib/**/*.ts",
        "hooks/**/*.ts",
        "components/**/*.tsx",
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
        "providers/**",
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
        "components/shared/app-sidebar.tsx",
        "components/shared/site-header.tsx",
        "components/shared/dashboard-shell.tsx",
        "components/shared/footer.tsx",
        "components/shared/marketing-shell.tsx",
        "components/shared/nav-main.tsx",
        "components/shared/nav-secondary.tsx",
        "components/shared/generic-nav-user.tsx",
        "components/shared/scroll-to-top.tsx",
        "components/shared/theme-toggle.tsx",
        "components/theme-provider.tsx",
        "components/marketing-header/**",
        // Legal (contenu statique)
        "components/shared/legal-*.tsx",
        // SEO (generation triviale)
        "components/seo/**",
        // Skeletons / Charts Recharts (wrappers)
        "components/admin/dashboard/skeleton.tsx",
        "components/admin/dashboard/domain-chart.tsx",
        "components/admin/dashboard/domain-chart-content.tsx",
        "components/admin/dashboard/revenue-chart.tsx",
        "components/admin/dashboard/revenue-chart-content.tsx",
        // Upload CDN-heavy
        "components/shared/avatar-uploader.tsx",
        "components/admin/question-image-uploader.tsx",
        // Marketing (display pur)
        "components/marketing/**",
        // Modals/forms lourds
        "components/shared/payments/manual-payment-modal.tsx",
        "components/shared/payments/edit-transaction-modal.tsx",
        "components/shared/payments/delete-transaction-dialog.tsx",
        "components/admin/question-form.tsx",
        "components/admin/edit-question-dialog.tsx",
        "components/admin/user-multi-select.tsx",
        "components/admin/exams-list.tsx",
        "components/admin/questions-list.tsx",
        "components/admin/question-browser/**",
        "components/admin/modals/**",
        // Quiz tools (complex UI, low logic)
        "components/quiz/calculator/**",
        "components/quiz/lab-values/**",
        "schemas/index.ts",
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
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["./vitest.setup.integration.ts"],
          fileParallelism: false,
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
