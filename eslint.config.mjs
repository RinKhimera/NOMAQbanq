import nextConfig from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"
import { defineConfig, globalIgnores } from "eslint/config"

const eslintConfig = defineConfig([
  ...nextConfig,
  ...nextTypeScript,

  {
    files: ["next-env.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },

  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/dist/**",
    "**/build/**",
    "**/convex/_generated/**",
    "**/*.tmp",
    "**/*.temp",
    ".env*",
  ]),
])

export default eslintConfig
