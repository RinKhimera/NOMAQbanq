/**
 * Amorçage UNIQUE : pousse dans le scope « Development » de Vercel toutes les
 * clés présentes dans .env.local mais encore absentes côté Vercel, pour que
 * `bun run env:sync` reproduise ensuite le fichier complet sur n'importe quel
 * PC. N'écrit QUE dans `development` (preview/prod jamais touchés). Idempotent.
 * Valeurs lues dans .env.local, passées par stdin (jamais en argv).
 *
 * Lancer une fois depuis le PC qui possède le .env.local complet :
 *   bun scripts/seed-vercel-dev-env.ts
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parse } from "dotenv"

import { parseRawLines } from "./sync-env"

/** Clés à amorcer = présentes en local (valeur non vide) et absentes de Vercel. */
export const keysToSeed = (
  localValues: Record<string, string>,
  existingKeys: Set<string>,
): string[] =>
  Object.entries(localValues)
    .filter(([k, v]) => v.trim() !== "" && !existingKeys.has(k))
    .map(([k]) => k)
    .sort()

const pullExistingKeys = (): Set<string> => {
  const tmp = join(mkdtempSync(join(tmpdir(), "env-seed-")), "pulled.env")
  const res = spawnSync(
    `vercel env pull "${tmp}" --environment=development --yes`,
    { shell: true, stdio: ["ignore", "inherit", "inherit"] },
  )
  if (res.status !== 0)
    throw new Error("`vercel env pull` a échoué (login/link OK ?).")
  const keys = new Set(parseRawLines(readFileSync(tmp, "utf8")).keys())
  rmSync(tmp, { recursive: true, force: true })
  return keys
}

const addVar = (key: string, value: string): void => {
  const res = spawnSync(`vercel env add ${key} development --yes`, {
    shell: true,
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
  })
  if (res.status !== 0)
    throw new Error(`vercel env add ${key} → exit ${res.status}`)
}

const main = (): void => {
  const localValues = parse(readFileSync(".env.local", "utf8"))
  const existing = pullExistingKeys()
  const toAdd = keysToSeed(localValues, existing)

  if (toAdd.length === 0) {
    console.log(
      "✓ Rien à amorcer : Vercel Dev contient déjà toutes les clés locales.",
    )
    return
  }

  console.log(
    `→ Amorçage de ${toAdd.length} clé(s) dans Vercel Dev : ${toAdd.join(", ")}`,
  )
  for (const key of toAdd) {
    addVar(key, localValues[key])
    console.log(`  ✓ ${key}`)
  }
  console.log("✓ Amorçage terminé. Vérifie : `vercel env ls development`.")
}

const isDirectRun =
  process.argv[1]?.endsWith("seed-vercel-dev-env.ts") ?? false
if (isDirectRun) main()
