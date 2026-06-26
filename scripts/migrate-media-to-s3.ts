/**
 * Migration one-off des médias Bunny → S3 (option 1 : piloté par la base).
 *
 * Copie UNIQUEMENT le média référencé en base (avatars, images de questions,
 * figures d'explication) — donc zéro orphelin. Télécharge chaque objet depuis
 * l'API Bunny Storage (autoritatif, découplé du DNS `cdn.nomaqbanq.ca`) et
 * l'upload vers S3 à la MÊME clé. Idempotent (skip si déjà sur S3).
 *
 * Usage (via Bun, qui charge `.env.local` automatiquement) :
 *   bun scripts/migrate-media-to-s3.ts --dry-run   # liste + comptes, n'écrit rien
 *   bun scripts/migrate-media-to-s3.ts             # copie réelle
 *   bun scripts/migrate-media-to-s3.ts --force     # ré-upload même si déjà sur S3
 *
 * Variables attendues dans `.env.local` :
 *   DATABASE_URL (ou DATABASE_URL_UNPOOLED)
 *   BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_API_KEY   (à remettre temporairement)
 *   BUNNY_STORAGE_HOST   (optionnel, défaut storage.bunnycdn.com ; régional si besoin)
 *   S3_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   NEXT_PUBLIC_CDN_HOSTNAME   (optionnel, défaut cdn.nomaqbanq.ca — sert à
 *                               reconnaître les clés d'avatar dans user.image)
 *
 * À lancer AVANT la bascule définitive ; re-jouable (copie incrémentale finale).
 */
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { Pool } from "pg"

const DRY_RUN = process.argv.includes("--dry-run")
const FORCE = process.argv.includes("--force")
const CONCURRENCY = 8

const need = (name: string): string => {
  const v = process.env[name]
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`)
  return v
}

const BUNNY_HOST = process.env.BUNNY_STORAGE_HOST ?? "storage.bunnycdn.com"
const BUNNY_ZONE = need("BUNNY_STORAGE_ZONE_NAME")
const BUNNY_KEY = need("BUNNY_STORAGE_API_KEY")
const CDN_HOST = process.env.NEXT_PUBLIC_CDN_HOSTNAME ?? "cdn.nomaqbanq.ca"
const BUCKET = need("S3_BUCKET")

const s3 = new S3Client({
  region: need("S3_REGION"),
  credentials: {
    accessKeyId: need("AWS_ACCESS_KEY_ID"),
    secretAccessKey: need("AWS_SECRET_ACCESS_KEY"),
  },
})

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? need("DATABASE_URL"),
})

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}
const contentTypeFor = (key: string): string =>
  CONTENT_TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ??
  "application/octet-stream"

/**
 * Dérive la clé de stockage d'une valeur `user.image` polymorphe :
 * - clé brute `avatars/…` → telle quelle
 * - URL absolue sur NOTRE CDN (`https://cdn.nomaqbanq.ca/avatars/…`) → la clé
 * - URL externe (avatar Google, etc.) → `null` (rien à migrer)
 */
const avatarKey = (image: string | null): string | null => {
  if (!image) return null
  if (image.startsWith("avatars/")) return image
  try {
    const u = new URL(image)
    if (u.hostname !== CDN_HOST) return null
    const path = decodeURIComponent(u.pathname).replace(/^\/+/, "")
    return path.startsWith("avatars/") ? path : null
  } catch {
    return null
  }
}

const collectKeys = async (): Promise<string[]> => {
  const keys = new Set<string>()

  const qi = await pool.query<{ storage_path: string }>(
    "SELECT storage_path FROM question_images",
  )
  for (const r of qi.rows) if (r.storage_path) keys.add(r.storage_path)

  const qe = await pool.query<{ image_path: string | null }>(
    "SELECT image_path FROM question_explanations WHERE image_path IS NOT NULL",
  )
  for (const r of qe.rows) if (r.image_path) keys.add(r.image_path)

  const us = await pool.query<{ image: string | null }>(
    `SELECT image FROM "user" WHERE image IS NOT NULL`,
  )
  for (const r of us.rows) {
    const k = avatarKey(r.image)
    if (k) keys.add(k)
  }

  return [...keys]
}

const existsOnS3 = async (key: string): Promise<boolean> => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

const downloadFromBunny = async (key: string): Promise<Buffer | null> => {
  const res = await fetch(`https://${BUNNY_HOST}/${BUNNY_ZONE}/${key}`, {
    headers: { AccessKey: BUNNY_KEY },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Bunny GET ${key} → HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

type Result = "copied" | "skipped" | "missing" | "error"

const migrateOne = async (key: string): Promise<Result> => {
  try {
    if (!FORCE && (await existsOnS3(key))) return "skipped"
    if (DRY_RUN) return "copied" // serait copié
    const body = await downloadFromBunny(key)
    if (!body) return "missing"
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentTypeFor(key),
      }),
    )
    return "copied"
  } catch (error) {
    console.error(
      `  ✗ ${key}: ${error instanceof Error ? error.message : error}`,
    )
    return "error"
  }
}

const runPool = async <T>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<void>,
): Promise<void> => {
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(size, items.length) },
    async () => {
      while (cursor < items.length) {
        await fn(items[cursor++])
      }
    },
  )
  await Promise.all(workers)
}

const main = async (): Promise<void> => {
  console.log(
    `Mode : ${DRY_RUN ? "DRY-RUN (aucune écriture ; « copiés » = à copier)" : FORCE ? "RÉEL (--force)" : "RÉEL"}`,
  )
  console.log(`Source Bunny : ${BUNNY_HOST}/${BUNNY_ZONE}`)
  console.log(`Cible S3 : ${BUCKET} (${process.env.S3_REGION})\n`)

  const keys = await collectKeys()
  console.log(`Clés référencées en base : ${keys.length}`)

  const counts: Record<Result, number> = {
    copied: 0,
    skipped: 0,
    missing: 0,
    error: 0,
  }
  let done = 0

  await runPool(keys, CONCURRENCY, async (key) => {
    counts[await migrateOne(key)]++
    if (++done % 50 === 0) console.log(`  … ${done}/${keys.length}`)
  })

  console.log("\n=== Résumé ===")
  console.log(`  ${DRY_RUN ? "à copier" : "copiés"}        : ${counts.copied}`)
  console.log(`  déjà sur S3      : ${counts.skipped}`)
  console.log(`  absents de Bunny : ${counts.missing}`)
  console.log(`  erreurs          : ${counts.error}`)

  await pool.end()
  if (counts.error > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
