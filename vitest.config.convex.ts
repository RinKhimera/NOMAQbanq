import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
    include: ["tests/convex/**/*.test.ts"],
    exclude: [],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
