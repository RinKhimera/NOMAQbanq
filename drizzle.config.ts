import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env.local" })
config()

const url = process.env.DATABASE_URL_UNPOOLED
if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED manquant. Ajoute-le dans .env.local (URL « direct connection » Neon, pas la pooled).",
  )
}

export default defineConfig({
  schema: "./db/schema/**/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
