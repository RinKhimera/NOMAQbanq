import nextConfig from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"
import tailwindCanonicalClasses from "eslint-plugin-tailwind-canonical-classes"
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

  {
    plugins: {
      "tailwind-canonical-classes": tailwindCanonicalClasses,
    },
    rules: {
      "tailwind-canonical-classes/tailwind-canonical-classes": [
        "warn",
        { cssPath: "./app/globals.css" },
      ],
    },
  },

  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/convex/_generated/**",
    "**/*.tmp",
    "**/*.temp",
    ".env*",
  ]),
])

export default eslintConfig
