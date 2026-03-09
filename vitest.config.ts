import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
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
        "convex/**/*.ts",
        "lib/**/*.ts",
        "hooks/**/*.ts",
        "components/**/*.tsx",
        "schemas/**/*.ts",
      ],
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "convex/_generated/**",
        "convex/schema.ts",
        "**/*.config.*",
        "**/*.d.ts",
        "components/ui/**",
        "app/**/layout.tsx",
        "app/**/page.tsx",
        "app/**/error.tsx",
        "app/**/not-found.tsx",
        "providers/**",
        "tests/**",
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
        // Modals/forms Convex-heavy
        "components/shared/payments/manual-payment-modal.tsx",
        "components/shared/payments/edit-transaction-modal.tsx",
        "components/shared/payments/delete-transaction-dialog.tsx",
        "components/admin/question-form.tsx",
        "components/admin/edit-question-dialog.tsx",
        "components/admin/exams-list.tsx",
        "components/admin/questions-list.tsx",
        "components/admin/question-browser/**",
      ],
      thresholds: {
        statements: 75,
        branches: 75,
        functions: 75,
        lines: 75,
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
          exclude: ["tests/convex/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["tests/convex/**/*.test.ts"],
          server: {
            deps: {
              inline: ["convex-test"],
            },
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
