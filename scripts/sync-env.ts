/**
 * Reconstruit .env.local depuis le scope « Development » de Vercel, regroupé en
 * sections (fonctionnel + tag de tier). `vercel env pull` produit un fichier
 * plat ; ce script le post-traite. Lancé via `bun run env:sync`.
 *
 * Garde-fou : si .env.local contient des clés ABSENTES du pull, on REFUSE
 * d'écraser (perte de données) — amorcer ces clés dans Vercel d'abord
 * (scripts/seed-vercel-dev-env.ts), ou forcer avec --force.
 */
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

type Group = { title: string; tier: string; keys: readonly string[] }

// Carte de groupes = point unique de catégorisation (alignée sur .env.example).
const GROUP_MAP: readonly Group[] = [
  {
    title: "Base de données — Neon",
    tier: "🟢 runtime, REQUIS",
    keys: ["DATABASE_URL", "DATABASE_URL_UNPOOLED"],
  },
  {
    title: "Better Auth",
    tier: "🟢 runtime, REQUIS",
    keys: ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"],
  },
  {
    title: "OAuth Google",
    tier: "🟢 runtime",
    keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    title: "AWS SES — emails",
    tier: "🟢 runtime",
    keys: [
      "SES_REGION",
      "SES_ACCESS_KEY_ID",
      "SES_SECRET_ACCESS_KEY",
      "EMAIL_FROM",
      "SES_CONFIGURATION_SET",
      "EMAIL_OVERRIDE_TO",
    ],
  },
  {
    title: "AWS S3 + CloudFront — médias",
    tier: "🟢 runtime",
    keys: [
      "S3_REGION",
      "S3_BUCKET",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "NEXT_PUBLIC_CDN_HOSTNAME",
    ],
  },
  { title: "Cron Vercel", tier: "🟢 runtime", keys: ["CRON_SECRET"] },
  {
    title: "Sentry — monitoring",
    tier: "🟡 build + 🟢 runtime",
    keys: ["SENTRY_AUTH_TOKEN", "NEXT_PUBLIC_SENTRY_DSN"],
  },
  {
    title: "Tests d'intégration — Neon API",
    tier: "🟡 outillage",
    keys: ["NEON_API_KEY", "NEON_PROJECT_ID"],
  },
  {
    title: "Tests E2E — Playwright",
    tier: "🟡 tests",
    keys: [
      "E2E_ADMIN_EMAIL",
      "E2E_ADMIN_PASSWORD",
      "E2E_USER_EMAIL",
      "E2E_USER_PASSWORD",
      "E2E_RESET_SECRET",
    ],
  },
  {
    title: "Vercel (auto-injecté)",
    tier: "—",
    keys: ["VERCEL_OIDC_TOKEN"],
  },
]

const HEADER =
  "# ⚠️  Généré par `bun run env:sync` — source de vérité : Vercel scope Development.\n" +
  "# Ne pas éditer à la main : toute nouvelle var doit être ajoutée sur Vercel\n" +
  "# (`vercel env add <KEY> development`), sinon le prochain sync l'efface.\n"

/** Map clé -> ligne brute (préservée telle quelle, jamais re-quotée). */
export const parseRawLines = (content: string): Map<string, string> => {
  const map = new Map<string, string>()
  for (const line of content.split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)
    if (m) map.set(m[1], line)
  }
  return map
}

/** Clés de `a` absentes de `b`, triées. */
export const keysOnlyIn = (a: Iterable<string>, b: Set<string>): string[] =>
  [...a].filter((k) => !b.has(k)).sort()

/** Regroupe le contenu plat d'un pull en sections (fonctionnel + tier). */
export const groupEnv = (content: string): string => {
  const lines = parseRawLines(content)
  const used = new Set<string>()
  const blocks: string[] = []

  for (const group of GROUP_MAP) {
    const body: string[] = []
    for (const k of group.keys) {
      const raw = lines.get(k)
      if (raw === undefined) continue
      body.push(raw)
      used.add(k)
    }
    if (body.length > 0)
      blocks.push(
        `# === ${group.title}  (${group.tier}) ===\n${body.join("\n")}`,
      )
  }

  const leftovers = [...lines.keys()].filter((k) => !used.has(k)).sort()
  if (leftovers.length > 0)
    blocks.push(
      `# === Non classé  (à ajouter à la carte de groupes) ===\n${leftovers
        .map((k) => lines.get(k) ?? "")
        .join("\n")}`,
    )

  return `${HEADER}\n${blocks.join("\n\n")}\n`
}

const main = (): void => {
  const force = process.argv.includes("--force")
  const tmp = join(mkdtempSync(join(tmpdir(), "env-sync-")), "pulled.env")

  console.log("→ vercel env pull (development)…")
  const pull = spawnSync(
    `vercel env pull "${tmp}" --environment=development --yes`,
    { shell: true, stdio: ["ignore", "inherit", "inherit"] },
  )
  if (pull.status !== 0) {
    console.error(
      "✗ `vercel env pull` a échoué. Connecté (`vercel login`) et lié (`vercel link`) ?",
    )
    process.exit(1)
  }

  const pulledContent = readFileSync(tmp, "utf8")
  rmSync(tmp, { recursive: true, force: true })
  const pulledKeys = new Set(parseRawLines(pulledContent).keys())

  if (existsSync(".env.local")) {
    const localKeys = parseRawLines(readFileSync(".env.local", "utf8")).keys()
    const wouldWipe = keysOnlyIn(localKeys, pulledKeys)
    if (wouldWipe.length > 0 && !force) {
      console.error(
        `✗ Refus d'écraser .env.local : ${wouldWipe.length} clé(s) locale(s) absente(s) de Vercel Dev seraient perdues :\n  ${wouldWipe.join(
          "\n  ",
        )}\n→ Amorce-les (\`bun scripts/seed-vercel-dev-env.ts\`) puis relance, ou force avec --force.`,
      )
      process.exit(1)
    }
  }

  writeFileSync(".env.local", groupEnv(pulledContent))

  const unclassified = keysOnlyIn(
    pulledKeys,
    new Set(GROUP_MAP.flatMap((g) => g.keys)),
  )
  console.log(`✓ .env.local régénéré : ${pulledKeys.size} variables.`)
  if (unclassified.length > 0)
    console.log(
      `ℹ ${unclassified.length} en « Non classé » : ${unclassified.join(", ")}`,
    )
}

const isDirectRun = process.argv[1]?.endsWith("sync-env.ts") ?? false
if (isDirectRun) main()
