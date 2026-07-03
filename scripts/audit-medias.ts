/**
 * Audit / GC des médias S3 (avatars + images de questions). DRY-RUN PAR DÉFAUT.
 *
 * Usage :
 *   bun run audit:medias                      # rapport seul (aucune écriture)
 *   bun run audit:medias -- --purge           # purge orphelins >24h + GC questions
 *                                             # soft-deleted déréférencées
 *   bun run audit:medias -- --purge --max 200 # borne du lot (défaut 50)
 *
 * Env requis (COMPLET) : DATABASE_URL, S3_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY (avec s3:ListBucket ; s3:DeleteObject pour --purge).
 *
 * Audit PROD (lecture seule) : pointer DATABASE_URL sur une BRANCHE Neon créée
 * depuis la prod (jamais la prod primaire) + credentials S3 de liste read-only.
 * Le script affiche sa CIBLE (bucket + host DB) au démarrage — vérifier cette
 * ligne avant de continuer (dotenv comble les vars absentes avec `.env.local`,
 * une omission ferait fuiter la cible DEV en silence).
 *
 * N'importe NI lib/aws.ts / lib/storage.ts (`server-only` interdit hors Next),
 * NI @/db (son import de lib/env/server exigerait TOUT le schéma d'env —
 * DATABASE_URL_UNPOOLED, BETTER_AUTH_SECRET…) : client S3 et pool pg locaux.
 */
import {
  DeleteObjectCommand,
  GetBucketLifecycleConfigurationCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3"
import { config } from "dotenv"
import { and, eq, isNotNull, notExists, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "../db/schema"
import {
  classifyImageValue,
  diffMediaRefs,
  referencedAvatarKeys,
} from "../lib/media-audit"

config({ path: ".env.local" })
config()

const {
  examAnswers,
  examQuestions,
  questionImages,
  questions,
  trainingSessionItems,
  user,
} = schema

const PURGE = process.argv.includes("--purge")
const MIN_AGE_MS = 24 * 60 * 60 * 1000 // jamais purger un objet < 24 h

// Lot borné : un diff faussé (mauvaise DB ciblée, listing S3 partiel) ne peut
// pas emporter plus de MAX_PURGE objets en un run — relancer pour continuer.
const maxFlag = process.argv.indexOf("--max")
const MAX_PURGE =
  maxFlag === -1 ? 50 : Number.parseInt(process.argv[maxFlag + 1] ?? "", 10)
if (!Number.isInteger(MAX_PURGE) || MAX_PURGE <= 0) {
  console.error("--max attend un entier positif (ex. --max 200).")
  process.exit(1)
}

const dbUrl = process.env.DATABASE_URL
const region = process.env.S3_REGION
const bucket = process.env.S3_BUCKET
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
if (!dbUrl || !region || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(
    "Env manquant (DATABASE_URL, S3_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).",
  )
  process.exit(1)
}

// Cible affichée pour confirmation visuelle (anti-fuite d'env dev en run prod).
console.log(
  `Cible : bucket=${bucket} · db=${new URL(dbUrl).hostname} · ${PURGE ? "MODE PURGE" : "dry-run"}`,
)

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
})
// Pool pg propre au script (pas de loadServerEnv, pas d'attachDatabasePool).
const pool = new Pool({ connectionString: dbUrl, max: 3 })
const db = drizzle(pool, { schema })

type S3Obj = { key: string; lastModified?: Date }

const listAll = async (prefix: string): Promise<S3Obj[]> => {
  const out: S3Obj[] = []
  let token: string | undefined
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    )
    for (const o of page.Contents ?? []) {
      if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified })
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return out
}

const deleteKey = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

// ---------- 1. Inventaire DB ----------
const users = await db.select({ image: user.image }).from(user)
const byKind = new Map<string, number>()
const externalHosts = new Map<string, number>()
for (const u of users) {
  const kind = classifyImageValue(u.image)
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1)
  if (kind === "external" && u.image) {
    try {
      const host = new URL(u.image).hostname
      externalHosts.set(host, (externalHosts.get(host) ?? 0) + 1)
    } catch {
      externalHosts.set(
        "(invalide)",
        (externalHosts.get("(invalide)") ?? 0) + 1,
      )
    }
  }
}
console.log(`\n=== user.image (${users.length} users) ===`)
for (const [kind, count] of [...byKind.entries()].sort()) {
  console.log(`  ${kind.padEnd(8)} ${count}`)
}
if (externalHosts.size > 0) {
  console.log(`  détail external par host :`)
  for (const [host, count] of [...externalHosts.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`    ${host} : ${count}`)
  }
}

const imageRows = await db
  .select({ storagePath: questionImages.storagePath })
  .from(questionImages)
const questionPaths = imageRows.map((r) => r.storagePath)
console.log(`\n=== question_images ===\n  ${questionPaths.length} référence(s)`)

// ---------- 2. Diff S3 ↔ DB ----------
let s3Avatars: S3Obj[], s3Questions: S3Obj[], s3Tmp: S3Obj[]
try {
  ;[s3Avatars, s3Questions, s3Tmp] = await Promise.all([
    listAll("avatars/"),
    listAll("questions/"),
    listAll("tmp/"),
  ])
} catch (error) {
  const named = error as { name?: string }
  if (named?.name === "AccessDenied") {
    console.error(
      "\n⛔ s3:ListBucket refusé pour ces credentials. Prérequis IAM : ajouter" +
        "\n   s3:ListBucket (+ s3:GetLifecycleConfiguration) sur le bucket à la" +
        "\n   policy de la clé utilisée (la clé dev historique est write-only).",
    )
    await pool.end()
    process.exit(1)
  }
  throw error
}
const s3ByKey = new Map(
  [...s3Avatars, ...s3Questions].map((o) => [o.key, o] as const),
)

const avatarDiff = diffMediaRefs(
  s3Avatars.map((o) => o.key),
  referencedAvatarKeys(users.map((u) => u.image)),
)
const questionDiff = diffMediaRefs(
  s3Questions.map((o) => o.key),
  questionPaths,
)

const report = (
  label: string,
  diff: { orphans: string[]; broken: string[] },
) => {
  console.log(`\n=== ${label} ===`)
  console.log(`  orphelins S3 : ${diff.orphans.length}`)
  for (const k of diff.orphans) console.log(`    - ${k}`)
  console.log(`  liens cassés DB→S3 : ${diff.broken.length}`)
  for (const k of diff.broken) console.log(`    ! ${k}`)
}
report("avatars/", avatarDiff)
report("questions/", questionDiff)
console.log(`\n=== tmp/ ===\n  ${s3Tmp.length} objet(s) (laissés au Lifecycle)`)

// ---------- 3. Règle Lifecycle tmp/ (informatif) ----------
try {
  const lc = await s3.send(
    new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }),
  )
  const tmpRule = lc.Rules?.some(
    (r) =>
      r.Status === "Enabled" &&
      (r.Filter?.Prefix ?? r.Prefix ?? "").startsWith("tmp/"),
  )
  console.log(
    tmpRule
      ? "\nLifecycle tmp/ : règle active ✓"
      : "\n⚠️ Lifecycle tmp/ : AUCUNE règle active — à configurer sur le bucket !",
  )
} catch {
  console.log("\nLifecycle tmp/ : non vérifiable (permission manquante)")
}

// ---------- 4. GC : questions soft-deleted totalement déréférencées ----------
const gcCandidates = await db
  .select({ id: questions.id })
  .from(questions)
  .where(
    and(
      isNotNull(questions.deletedAt),
      notExists(
        db
          .select({ one: sql`1` })
          .from(examQuestions)
          .where(eq(examQuestions.questionId, questions.id)),
      ),
      notExists(
        db
          .select({ one: sql`1` })
          .from(examAnswers)
          .where(eq(examAnswers.questionId, questions.id)),
      ),
      notExists(
        db
          .select({ one: sql`1` })
          .from(trainingSessionItems)
          .where(eq(trainingSessionItems.questionId, questions.id)),
      ),
    ),
  )
console.log(
  `\n=== GC ===\n  ${gcCandidates.length} question(s) soft-deleted déréférencée(s)`,
)

// ---------- 5. Purge (opt-in) ----------
if (!PURGE) {
  console.log("\nDry-run terminé. Relancer avec `-- --purge` pour agir.")
  await pool.end()
  process.exit(0)
}

// Le diff « orphelins » n'est valide que si la base ciblée est la SOURCE DE
// VÉRITÉ du bucket ciblé — un croisement (base dev ↔ bucket prod, ou l'inverse)
// ferait paraître orphelins des objets référencés par l'autre environnement.
console.warn(
  "\n⚠️ PURGE : vérifie la ligne « Cible » ci-dessus — la base ciblée doit être" +
    "\n   la source de vérité du bucket ciblé (dev↔dev, prod↔prod).",
)

const now = Date.now()
const purgeable = [...avatarDiff.orphans, ...questionDiff.orphans].filter(
  (key) => {
    const lm = s3ByKey.get(key)?.lastModified
    return lm !== undefined && now - lm.getTime() > MIN_AGE_MS
  },
)
const purgeLot = purgeable.slice(0, MAX_PURGE)
console.log(
  `\nPurge de ${purgeLot.length}/${purgeable.length} orphelin(s) S3 (>24h, lot borné à ${MAX_PURGE}) :`,
)
for (const key of purgeLot) console.log(`  → ${key}`)
for (const key of purgeLot) {
  await deleteKey(key)
  console.log(`  supprimé : ${key}`)
}
if (purgeable.length > purgeLot.length) {
  console.log(
    `  ${purgeable.length - purgeLot.length} orphelin(s) restant(s) — relancer pour continuer.`,
  )
}

const gcLot = gcCandidates.slice(0, MAX_PURGE)
for (const q of gcLot) {
  const paths = await db
    .select({ storagePath: questionImages.storagePath })
    .from(questionImages)
    .where(eq(questionImages.questionId, q.id))
  // FK restrict = filet : si une référence est apparue entre-temps, ce DELETE
  // lève et le script s'arrête bruyamment (relancer l'audit).
  await db.delete(questions).where(eq(questions.id, q.id))
  for (const p of paths) await deleteKey(p.storagePath)
  console.log(`  GC question ${q.id} (${paths.length} image(s))`)
}
if (gcCandidates.length > gcLot.length) {
  console.log(
    `  ${gcCandidates.length - gcLot.length} question(s) GC restante(s) — relancer pour continuer.`,
  )
}

console.log("\nPurge terminée.")
await pool.end()
process.exit(0)
