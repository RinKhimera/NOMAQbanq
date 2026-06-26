# Migration Bunny → AWS S3 + CloudFront — Implementation Plan

> **⚠️ Obsolète sur un point (note 2026-06-25) :** la variable de région est
> **`S3_REGION`**, PAS `AWS_REGION`. `AWS_REGION` est réservée par le runtime
> Lambda/Vercel (région d'exécution) et primerait → presign signé pour la
> mauvaise région → **403**. Partout ci-dessous où ce plan écrit `AWS_REGION`
> (`vercel env add`, schéma env, `new S3Client`…), lire `S3_REGION`. La checklist
> de bascule (`2026-06-24-bunny-to-s3-production-cutover-checklist.md`) fait foi.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer Bunny Storage + Bunny CDN par AWS S3 (privé, us-east-2) + CloudFront (OAC), avec upload direct navigateur→S3 par presigned POST et auth AWS via Vercel OIDC, sans aucune migration de schéma DB.

**Architecture:** Le domaine `cdn.nomaqbanq.ca` est conservé (les `storagePath` relatifs et les URLs d'avatars stockées continuent de résoudre). L'upload passe d'un proxy serveur à un **presigned POST** : un Server Action gardé (auth + rate-limit + validation) renvoie `{ url, fields, storagePath }`, le navigateur POST le fichier directement à S3, puis un Server Action persiste le `storagePath`. La lecture passe par CloudFront (bucket privé via Origin Access Control).

**Tech Stack:** Next.js 16 App Router · TypeScript · Drizzle/Neon · `@aws-sdk/client-s3` · `@aws-sdk/s3-presigned-post` · `@vercel/oidc-aws-credentials-provider` · Vitest · rclone (migration).

**Spec de référence:** `docs/superpowers/specs/2026-06-24-bunny-to-s3-cloudfront-migration-design.md`

**Ordre de bascule (résumé):** le code (Phases 1-5) est testable indépendamment (SDK mocké). La provision AWS (Phase 0) et la copie de données + cutover DNS (Phase 6) sont des runbooks manuels, à exécuter autour du déploiement.

---

## Phase 0 — Provisionnement AWS (runbook manuel, prérequis au live)

> Aucune ligne de code. À exécuter une fois (par toi, avec tes credentials AWS admin). Les Phases 1-5 n'en dépendent pas pour compiler/tester (SDK mocké), mais le **déploiement** en a besoin. Remplace `<ACCOUNT_ID>`, `<TEAM_SLUG>`, `<PROJECT>`, `<BUCKET>`.

### Task 0.1: Créer le bucket S3 privé

- [ ] **Step 1: Créer le bucket en us-east-2, Block Public Access activé**

```bash
aws s3api create-bucket \
  --bucket <BUCKET> \
  --region us-east-2 \
  --create-bucket-configuration LocationConstraint=us-east-2

aws s3api put-public-access-block \
  --bucket <BUCKET> \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

- [ ] **Step 2: Appliquer la config CORS (upload navigateur)**

Crée `cors.json` (ajuste les origines prod) :

```json
{
  "CORSRules": [
    {
      "AllowedMethods": ["POST"],
      "AllowedOrigins": [
        "https://www.nomaqbanq.ca",
        "https://nomaqbanq.ca",
        "https://*.vercel.app",
        "http://localhost:3000"
      ],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

```bash
aws s3api put-bucket-cors --bucket <BUCKET> --cors-configuration file://cors.json
```

Vérif : `aws s3api get-bucket-cors --bucket <BUCKET>`.

### Task 0.2: Configurer OIDC Vercel → rôle IAM

- [ ] **Step 1: Créer l'IdP OIDC (Console AWS → IAM → Identity Providers → Add)**
  - Provider URL : `https://oidc.vercel.com/<TEAM_SLUG>`
  - Audiences : `https://vercel.com/<TEAM_SLUG>` **et** `sts.amazonaws.com`

- [ ] **Step 2: Créer le rôle avec trust policy**

`trust-policy.json` :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/oidc.vercel.com/<TEAM_SLUG>"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.vercel.com/<TEAM_SLUG>:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "oidc.vercel.com/<TEAM_SLUG>:sub": [
            "owner:<TEAM_SLUG>:project:<PROJECT>:environment:production",
            "owner:<TEAM_SLUG>:project:<PROJECT>:environment:preview"
          ]
        }
      }
    }
  ]
}
```

```bash
aws iam create-role --role-name nomaqbanq-s3-media \
  --assume-role-policy-document file://trust-policy.json
```

- [ ] **Step 3: Attacher la policy least-privilege**

`s3-policy.json` :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::<BUCKET>/questions/*",
        "arn:aws:s3:::<BUCKET>/avatars/*"
      ]
    }
  ]
}
```

```bash
aws iam put-role-policy --role-name nomaqbanq-s3-media \
  --policy-name s3-media-write --policy-document file://s3-policy.json
```

Note l'ARN du rôle (`aws iam get-role --role-name nomaqbanq-s3-media --query Role.Arn`).

### Task 0.3: CloudFront + ACM + OAC sur cdn.nomaqbanq.ca

- [ ] **Step 1: Certificat ACM en us-east-1 (exigence CloudFront)**

```bash
aws acm request-certificate --region us-east-1 \
  --domain-name cdn.nomaqbanq.ca --validation-method DNS
```

Ajoute l'enregistrement CNAME de validation chez ton registrar DNS, attends `ISSUED`.

- [ ] **Step 2: Créer l'Origin Access Control**

```bash
aws cloudfront create-origin-access-control --origin-access-control-config \
  Name=nomaqbanq-oac,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3
```

- [ ] **Step 3: Créer la distribution** (origine = bucket, alias `cdn.nomaqbanq.ca`, cert ACM, OAC, compression, response-headers-policy avec `X-Content-Type-Options: nosniff` + cache long). Via Console (plus simple pour ce JSON volumineux) ou `aws cloudfront create-distribution --distribution-config file://dist.json`. Récupère le _Distribution domain name_ (`dxxxx.cloudfront.net`).

- [ ] **Step 4: Bucket policy autorisant CloudFront (OAC) à lire**

`bucket-policy.json` :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::<BUCKET>/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
        }
      }
    }
  ]
}
```

```bash
aws s3api put-bucket-policy --bucket <BUCKET> --policy file://bucket-policy.json
```

- [ ] **Step 5: Test fumée hors-prod** : upload un objet test et sers-le via le domaine `*.cloudfront.net` par défaut (pas encore le domaine custom).

```bash
aws s3 cp ./test.jpg s3://<BUCKET>/questions/_smoke/test.jpg --content-type image/jpeg
curl -I https://dxxxx.cloudfront.net/questions/_smoke/test.jpg   # attendu : 200 + content-type image/jpeg
aws s3 rm s3://<BUCKET>/questions/_smoke/test.jpg
```

### Task 0.4: Variables d'env Vercel

- [ ] **Step 1: Déclarer pour Production ET Preview**

```bash
vercel env add AWS_REGION production       # -> us-east-2
vercel env add AWS_REGION preview          # -> us-east-2
vercel env add AWS_ROLE_ARN production      # -> arn:aws:iam::<ACCOUNT_ID>:role/nomaqbanq-s3-media
vercel env add AWS_ROLE_ARN preview         # -> (même ARN)
vercel env add S3_BUCKET production         # -> <BUCKET>
vercel env add S3_BUCKET preview            # -> <BUCKET>
```

> ⚠️ `AWS_REGION` doit être déclaré explicitement : Vercel le définit dynamiquement selon la région d'exécution sinon (cf. avertissement officiel).

---

## Phase 1 — Dépendances, env & host CDN

### Task 1.1: Installer les paquets AWS

**Files:**

- Modify: `package.json` (via gestionnaire)

- [ ] **Step 1: Installer**

```bash
bun add @aws-sdk/client-s3 @aws-sdk/s3-presigned-post @vercel/oidc-aws-credentials-provider
```

- [ ] **Step 2: Vérifier la compilation**

Run: `bun run check`
Expected: PASS (aucune référence aux nouveaux paquets encore, juste ajoutés).

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): add AWS S3 SDK + Vercel OIDC credentials provider"
```

### Task 1.2: Ajouter les vars S3 au schéma env (additif, Bunny conservé)

**Files:**

- Modify: `lib/env/schema.ts`
- Test: `tests/lib/env.test.ts`

- [ ] **Step 1: Écrire les tests d'abord**

Ajoute dans `tests/lib/env.test.ts`, dans `describe("loadServerEnv")` :

```ts
it("accepte une config AWS S3 complète", () => {
  expect(
    loadServerEnv({
      ...valid,
      AWS_REGION: "us-east-2",
      AWS_ROLE_ARN: "arn:aws:iam::1:role/x",
      S3_BUCKET: "nomaq-media",
    }).S3_BUCKET,
  ).toBe("nomaq-media")
})

it("rejette une config AWS S3 partielle (role sans bucket)", () => {
  expect(() =>
    loadServerEnv({ ...valid, AWS_ROLE_ARN: "arn:aws:iam::1:role/x" }),
  ).toThrow(/AWS S3 incompl/)
})
```

- [ ] **Step 2: Lancer pour voir échouer**

Run: `bun run test -- env`
Expected: FAIL (`AWS S3 incompl…` non levé ; `S3_BUCKET` inconnu du schéma).

- [ ] **Step 3: Ajouter les champs au schéma**

Dans `lib/env/schema.ts`, à l'intérieur du `z.object({ … })`, juste après les vars Bunny existantes (qu'on **garde pour l'instant**), ajoute :

```ts
    // AWS S3 (stockage médias) — optionnelles : l'app démarre sans, `lib/aws.ts`
    // lève une erreur claire à l'usage. ROLE_ARN+BUCKET vont ensemble (refine).
    // Auth via OIDC (AWS_ROLE_ARN) en prod/preview. AWS_REGION pinné (Vercel le
    // définit dynamiquement sinon). Clés statiques = fallback dev local.
    AWS_REGION: z.string().optional(),
    AWS_ROLE_ARN: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
```

Puis, après le `.refine(...)` Bunny existant, chaîne un nouveau refine :

```ts
    // Garde-fou : ROLE_ARN et BUCKET vont ensemble. (AWS_REGION exclu du refine :
    // Vercel le définit automatiquement, donc sa présence seule n'indique rien.)
    .refine(
      (e) => {
        const set = [e.AWS_ROLE_ARN, e.S3_BUCKET].filter(Boolean).length
        return set === 0 || set === 2
      },
      {
        error:
          "Configuration AWS S3 incomplète : AWS_ROLE_ARN et S3_BUCKET doivent être définis ensemble (et AWS_REGION pinné)",
        path: ["S3_BUCKET"],
      },
    )
```

- [ ] **Step 4: Lancer pour voir passer**

Run: `bun run test -- env`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/env/schema.ts tests/lib/env.test.ts
git commit -m "feat(env): add AWS S3 vars (AWS_REGION/ROLE_ARN/S3_BUCKET) with all-or-nothing refine"
```

### Task 1.3: Exporter `CDN_HOST` et accepter `NEXT_PUBLIC_CDN_HOSTNAME`

**Files:**

- Modify: `lib/cdn.ts`

- [ ] **Step 1: Remplacer le contenu de `lib/cdn.ts`**

```ts
// URL d'affichage publique d'un objet média, dérivée de son `storagePath`.
// L'hôte est public (déclaré dans next.config images domains). Défaut = CDN prod.
// `NEXT_PUBLIC_BUNNY_CDN_HOSTNAME` reste accepté en repli le temps de la bascule.
export const CDN_HOST =
  process.env.NEXT_PUBLIC_CDN_HOSTNAME ??
  process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME ??
  "cdn.nomaqbanq.ca"

export const cdnUrl = (storagePath: string): string =>
  `https://${CDN_HOST}/${storagePath.replace(/^\/+/, "")}`
```

- [ ] **Step 2: Vérifier compilation + tests**

Run: `bun run check && bun run test -- cdn`
Expected: PASS (si aucun test `cdn` dédié, la commande passe sans cas — OK).

- [ ] **Step 3: Commit**

```bash
git add lib/cdn.ts
git commit -m "feat(cdn): export CDN_HOST, accept NEXT_PUBLIC_CDN_HOSTNAME (fallback to legacy var)"
```

---

## Phase 2 — Couche stockage S3 (`lib/aws.ts` + `lib/storage.ts`)

### Task 2.1: Créer `lib/aws.ts` (client S3 + presigned POST + delete)

**Files:**

- Create: `lib/aws.ts`

- [ ] **Step 1: Écrire le module**

```ts
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider"
import "server-only"
import { env } from "@/lib/env/server"

/**
 * Couche AWS S3 bas-niveau (server-only) : client + presigned POST (upload
 * direct navigateur→S3) + suppression d'objet. La sécurité des chemins et les
 * helpers de domaine vivent dans `lib/storage.ts`. Auth via Vercel OIDC → rôle
 * IAM (aucun secret long-vécu en prod ; clés statiques = fallback dev local
 * géré par la chaîne de credentials par défaut du SDK).
 */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 Mo (aligne avec validateImageFile)

let client: S3Client | undefined

const getClient = (): S3Client => {
  if (!env.AWS_REGION || !env.AWS_ROLE_ARN) {
    throw new Error(
      "Configuration AWS manquante (AWS_REGION, AWS_ROLE_ARN, S3_BUCKET).",
    )
  }
  client ??= new S3Client({
    region: env.AWS_REGION,
    credentials: awsCredentialsProvider({
      roleArn: env.AWS_ROLE_ARN,
      audience: "sts.amazonaws.com",
    }),
  })
  return client
}

const getBucket = (): string => {
  if (!env.S3_BUCKET) {
    throw new Error("Configuration AWS manquante (S3_BUCKET).")
  }
  return env.S3_BUCKET
}

export type PresignedUpload = {
  url: string
  fields: Record<string, string>
}

/**
 * Presigned POST verrouillé : clé exacte (non falsifiable), taille [1, 5 Mo]
 * (content-length-range), Content-Type exact, expiration 60 s. C'est S3 qui
 * impose la taille — le fichier ne transite pas par notre serveur.
 */
export const createPresignedUpload = async (
  storagePath: string,
  contentType: string,
): Promise<PresignedUpload> => {
  const { url, fields } = await createPresignedPost(getClient(), {
    Bucket: getBucket(),
    Key: storagePath,
    Expires: 60,
    Conditions: [
      ["content-length-range", 1, MAX_UPLOAD_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
  })
  return { url, fields }
}

/** Supprime un objet S3 (idempotent : 204 même si absent). Best-effort. */
export const deleteFromS3 = async (storagePath: string): Promise<boolean> => {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: storagePath }),
    )
    return true
  } catch (error) {
    console.error("S3 delete error:", error)
    return false
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/aws.ts
git commit -m "feat(storage): add lib/aws.ts (S3 client via OIDC, presigned POST, delete)"
```

### Task 2.2: Créer `lib/storage.ts` (helpers de domaine, portés de `lib/bunny.ts`)

**Files:**

- Create: `lib/storage.ts`
- Test: `tests/lib/storage.test.ts`

- [ ] **Step 1: Écrire les tests d'abord**

Crée `tests/lib/storage.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest"
import {
  assertSafeStoragePath,
  avatarStoragePathFromUrl,
  generateAvatarPath,
  generateQuestionImagePath,
  getExtensionFromMimeType,
  validateImageFile,
} from "@/lib/storage"

vi.mock("server-only", () => ({}))
// Évite de charger le SDK AWS dans ce test unitaire des helpers purs.
vi.mock("@/lib/aws", () => ({ deleteFromS3: vi.fn() }))

describe("path helpers", () => {
  it("génère un chemin d'image question préfixé", () => {
    expect(generateQuestionImagePath("q1", 2, ".PNG")).toMatch(
      /^questions\/q1\/\d+-2\.png$/,
    )
  })
  it("génère un chemin d'avatar préfixé", () => {
    expect(generateAvatarPath("u1", "jpg")).toMatch(/^avatars\/u1\/\d+\.jpg$/)
  })
  it("mappe le MIME vers l'extension", () => {
    expect(getExtensionFromMimeType("image/webp")).toBe("webp")
    expect(getExtensionFromMimeType("application/pdf")).toBe("jpg")
  })
})

describe("assertSafeStoragePath", () => {
  it("rejette le path traversal", () => {
    expect(() => assertSafeStoragePath("../x")).toThrow()
    expect(() => assertSafeStoragePath("/abs")).toThrow()
    expect(() => assertSafeStoragePath("a//b")).toThrow()
  })
  it("accepte un chemin légitime", () => {
    expect(() => assertSafeStoragePath("avatars/u1/123.jpg")).not.toThrow()
  })
})

describe("avatarStoragePathFromUrl", () => {
  it("renvoie le chemin pour notre CDN + préfixe avatars/", () => {
    expect(
      avatarStoragePathFromUrl("https://cdn.nomaqbanq.ca/avatars/u1/9.jpg"),
    ).toBe("avatars/u1/9.jpg")
  })
  it("renvoie null pour un hôte externe", () => {
    expect(
      avatarStoragePathFromUrl("https://lh3.googleusercontent.com/a/x"),
    ).toBeNull()
  })
  it("renvoie null hors préfixe avatars/", () => {
    expect(
      avatarStoragePathFromUrl("https://cdn.nomaqbanq.ca/questions/q/1.jpg"),
    ).toBeNull()
  })
})

describe("validateImageFile", () => {
  it("accepte un JPEG valide", () => {
    expect(validateImageFile("image/jpeg", 1000)).toBeNull()
  })
  it("refuse un type non supporté", () => {
    expect(validateImageFile("application/pdf", 1000)).toContain("Format")
  })
  it("refuse un fichier trop volumineux", () => {
    expect(validateImageFile("image/png", 6 * 1024 * 1024)).toContain(
      "volumineux",
    )
  })
})
```

- [ ] **Step 2: Lancer pour voir échouer**

Run: `bun run test -- storage`
Expected: FAIL (`@/lib/storage` n'existe pas encore).

- [ ] **Step 3: Écrire `lib/storage.ts`**

```ts
import "server-only"
import { deleteFromS3 } from "@/lib/aws"
import { CDN_HOST } from "@/lib/cdn"
import { env } from "@/lib/env/server"

/**
 * Couche stockage médias (server-only) : config, sécurité des chemins, helpers
 * de chemins dérivés serveur, validation, et suppression best-effort. Les I/O
 * réseau S3 (presign, delete) sont dans `lib/aws.ts`. Porté de `lib/bunny.ts`.
 */

/** `true` si les trois vars S3 sont présentes (upload possible). */
export const isStorageConfigured = (): boolean =>
  Boolean(env.AWS_REGION && env.AWS_ROLE_ARN && env.S3_BUCKET)

// ---------- Path safety (anti path-traversal / SSRF) ----------

const hasControlOrSpace = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) <= 0x20) return true
  }
  return false
}

export const assertSafeStoragePath = (storagePath: string): void => {
  if (
    !storagePath ||
    storagePath.startsWith("/") ||
    storagePath.includes("..") ||
    storagePath.includes("\\") ||
    storagePath.includes("//") ||
    hasControlOrSpace(storagePath)
  ) {
    throw new Error(`storagePath invalide: ${storagePath}`)
  }
}

// ---------- Delete (best-effort) ----------

/**
 * Supprime un chemin best-effort : no-op si S3 non configuré, avale toute erreur
 * (chemin invalide, réseau). Pour les flux où l'échec de suppression ne doit pas
 * faire échouer l'action (ancien avatar, orphelin).
 */
export const tryDeleteFromStorage = async (
  storagePath: string,
): Promise<void> => {
  if (!isStorageConfigured()) return
  try {
    assertSafeStoragePath(storagePath)
    await deleteFromS3(storagePath)
  } catch (error) {
    console.error("S3 delete (best-effort) error:", error)
  }
}

// ---------- Path helpers (dérivés serveur) ----------

export const generateQuestionImagePath = (
  questionId: string,
  index: number,
  extension: string,
): string => {
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `questions/${questionId}/${Date.now()}-${index}.${cleanExt}`
}

export const generateAvatarPath = (
  userId: string,
  extension: string,
): string => {
  const cleanExt = extension.replace(/^\./, "").toLowerCase()
  return `avatars/${userId}/${Date.now()}.${cleanExt}`
}

/**
 * Reconstruit le `storagePath` d'un avatar à partir de son URL stockée UNIQUEMENT
 * si l'URL pointe vers notre CDN (`CDN_HOST`) et le préfixe `avatars/`. `null`
 * pour toute URL externe (Google OAuth, legacy) → la suppression au remplacement
 * ne touche jamais un fichier qui ne nous appartient pas.
 */
export const avatarStoragePathFromUrl = (
  url: string | null | undefined,
): string | null => {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== CDN_HOST) return null
    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "")
    if (!path.startsWith("avatars/") || path.includes("..")) return null
    return path
  } catch {
    return null
  }
}

export const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }
  return mimeToExt[mimeType] || "jpg"
}

// ---------- Validation ----------

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 Mo

/** `null` si valide, message d'erreur FR sinon. */
export const validateImageFile = (
  mimeType: string,
  size: number,
): string | null => {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return "Format non supporté. Utilisez JPG, PNG ou WebP."
  }
  if (size <= 0) return "Fichier vide."
  if (size > MAX_FILE_SIZE) {
    return `Fichier trop volumineux. Maximum ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
  }
  return null
}
```

- [ ] **Step 4: Lancer pour voir passer**

Run: `bun run test -- storage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts tests/lib/storage.test.ts
git commit -m "feat(storage): add lib/storage.ts (path helpers, validation, best-effort delete)"
```

---

## Phase 3 — Server Actions (presigned POST)

> `lib/bunny.ts` reste présent jusqu'à la Phase 5. À partir d'ici, les actions n'importent plus de `@/lib/bunny`.

### Task 3.1: Avatar — `createAvatarUpload` + `confirmAvatarUpload`

**Files:**

- Modify: `features/users/actions.ts`
- Test: `tests/integration/uploads-actions.test.ts`

- [ ] **Step 1: Réécrire le bloc imports + la section avatar de `features/users/actions.ts`**

Remplace l'import depuis `@/lib/bunny` par :

```ts
import { requireRole, requireSession } from "@/lib/auth-guards"
import { createPresignedUpload } from "@/lib/aws"
import { cdnUrl } from "@/lib/cdn"
import {
  avatarStoragePathFromUrl,
  generateAvatarPath,
  getExtensionFromMimeType,
  isStorageConfigured,
  tryDeleteFromStorage,
  validateImageFile,
} from "@/lib/storage"
import { consumeUploadRateLimit } from "@/lib/upload-rate-limit"
```

Supprime `UploadAvatarResult` et toute la fonction `uploadAvatar`, et mets à la place :

```ts
export type CreateUploadResult =
  | {
      success: true
      url: string
      fields: Record<string, string>
      storagePath: string
    }
  | { success: false; error: string }

/**
 * Étape 1 de l'upload avatar : garde session → validation type/taille →
 * rate-limit (5/h) → presigned POST S3 (`avatars/{userId}/…`). Le `userId` vient
 * de la session (jamais du client) → chemin non falsifiable. Le fichier ne
 * transite PAS par le serveur.
 */
export const createAvatarUpload = async (input: {
  contentType: string
  size: number
}): Promise<CreateUploadResult> => {
  const session = await requireSession()
  const userId = session.user.id

  const validationError = validateImageFile(input.contentType, input.size)
  if (validationError) return { success: false, error: validationError }

  if (!isStorageConfigured()) {
    return {
      success: false,
      error: "Le téléversement d'images n'est pas configuré.",
    }
  }

  const limit = await consumeUploadRateLimit(userId, "avatar")
  if (!limit.allowed) {
    return {
      success: false,
      error: `Limite d'uploads atteinte. Réessayez dans ${limit.retryAfterMinutes} minute(s).`,
    }
  }

  const storagePath = generateAvatarPath(
    userId,
    getExtensionFromMimeType(input.contentType),
  )
  try {
    const { url, fields } = await createPresignedUpload(
      storagePath,
      input.contentType,
    )
    return { success: true, url, fields, storagePath }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[createAvatarUpload]", error)
    }
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
}

// Un chemin d'avatar légitime : `avatars/{id}/{timestamp}.{ext}`.
const AVATAR_PATH_RE = /^avatars\/[A-Za-z0-9_-]{1,64}\/\d+\.(jpg|png|webp)$/

/**
 * Étape 2 : après l'upload S3 réussi, persiste `user.image` = `cdnUrl(storagePath)`.
 * Le `storagePath` DOIT appartenir au préfixe de l'utilisateur courant (re-vérifié)
 * → non falsifiable. Supprime l'ancien avatar s'il nous appartient. En cas
 * d'échec DB, nettoie l'objet S3 fraîchement uploadé (pas d'orphelin).
 */
export const confirmAvatarUpload = async (input: {
  storagePath: string
}): Promise<UpdateProfileResult> => {
  const session = await requireSession()
  const userId = session.user.id

  if (
    !AVATAR_PATH_RE.test(input.storagePath) ||
    !input.storagePath.startsWith(`avatars/${userId}/`)
  ) {
    return { success: false, error: "Chemin d'avatar invalide" }
  }

  const [current] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const newUrl = cdnUrl(input.storagePath)
  try {
    await db.update(user).set({ image: newUrl }).where(eq(user.id, userId))
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[confirmAvatarUpload]", error)
    }
    await tryDeleteFromStorage(input.storagePath)
    return { success: false, error: "Erreur serveur. Réessayez." }
  }

  const oldPath = avatarStoragePathFromUrl(current?.image)
  if (oldPath && oldPath !== input.storagePath) {
    await tryDeleteFromStorage(oldPath)
  }

  revalidatePath("/dashboard/profil")
  revalidatePath("/admin/profil")
  return { success: true, url: newUrl }
}
```

> Note : `UpdateProfileResult` est `{ success: boolean; error?: string }` (déjà défini en haut du fichier). On y ajoute `url?` au retour de `confirmAvatarUpload` ; comme `url` n'est pas dans le type, élargis le type de retour à `UpdateProfileResult & { url?: string }` ou change la signature en `Promise<UpdateProfileResult & { url?: string }>`. Utilise :
> `): Promise<UpdateProfileResult & { url?: string }> => {`

- [ ] **Step 2: Réécrire les tests d'intégration avatar**

Remplace l'en-tête de mock de `tests/integration/uploads-actions.test.ts` (lignes 25-44) par :

```ts
import { createQuestionImageUpload } from "@/features/questions/actions"
import {
  confirmAvatarUpload,
  createAvatarUpload,
} from "@/features/users/actions"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { createPresignedUpload } from "@/lib/aws"

// Mock PARTIEL de storage : garde les helpers purs RÉELS ; force la config
// présente et neutralise la suppression réseau.
vi.mock("@/lib/aws", () => ({
  createPresignedUpload: vi.fn(
    async (storagePath: string, contentType: string) => ({
      url: "https://s3.test.invalid/bucket",
      fields: { key: storagePath, "Content-Type": contentType },
    }),
  ),
  deleteFromS3: vi.fn().mockResolvedValue(true),
}))
vi.mock("@/lib/storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/storage")>()
  return {
    ...actual,
    isStorageConfigured: () => true,
    tryDeleteFromStorage: vi.fn().mockResolvedValue(undefined),
  }
})
```

Remplace tout le `describe("uploadAvatar", …)` par :

```ts
describe("createAvatarUpload + confirmAvatarUpload", () => {
  beforeAll(() => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: userId, role: "user" },
    } as never)
  })

  it("renvoie un presigned POST sur un chemin avatar dérivé serveur", async () => {
    const res = await createAvatarUpload({
      contentType: "image/jpeg",
      size: 1000,
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.storagePath).toMatch(new RegExp(`^avatars/${userId}/`))
      expect(res.fields["Content-Type"]).toBe("image/jpeg")
      expect(vi.mocked(createPresignedUpload)).toHaveBeenCalledWith(
        res.storagePath,
        "image/jpeg",
      )
    }
  })

  it("confirme et met à jour user.image (cdnUrl du chemin)", async () => {
    const created = await createAvatarUpload({
      contentType: "image/jpeg",
      size: 1000,
    })
    if (!created.success) throw new Error("setup")
    const res = await confirmAvatarUpload({ storagePath: created.storagePath })
    expect(res.success).toBe(true)

    const [row] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    expect(row?.image).toBe(`https://cdn.nomaqbanq.ca/${created.storagePath}`)
  })

  it("refuse de confirmer le chemin d'un autre utilisateur", async () => {
    const res = await confirmAvatarUpload({
      storagePath: `avatars/${adminId}/123.jpg`,
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("invalide")
  })

  it("refuse un type non-image avant tout presign", async () => {
    const res = await createAvatarUpload({
      contentType: "application/pdf",
      size: 10,
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("Format")
  })
})
```

(La section `describe("uploadQuestionImage", …)` est réécrite à la Task 3.2.)

- [ ] **Step 3: Lancer les tests d'intégration**

Run: `bun run test:integration -- uploads-actions`
Expected: PASS pour les cas avatar (les cas question échouent encore — réécrits en 3.2). Si le runner ne filtre pas par nom, lance `bun run test:integration` et concentre-toi sur les cas avatar.

- [ ] **Step 4: Vérifier la compilation**

Run: `bun run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/users/actions.ts tests/integration/uploads-actions.test.ts
git commit -m "feat(users): avatar upload via presigned POST (createAvatarUpload + confirmAvatarUpload)"
```

### Task 3.2: Question images — `createQuestionImageUpload` + delete S3

**Files:**

- Modify: `features/questions/actions.ts`
- Test: `tests/integration/uploads-actions.test.ts`, `tests/integration/questions-actions.test.ts`

- [ ] **Step 1: Réécrire imports + actions dans `features/questions/actions.ts`**

Remplace l'import depuis `@/lib/bunny` (lignes 9-16) par :

```ts
import { createPresignedUpload } from "@/lib/aws"
import { createId } from "@/lib/ids"
import {
  generateQuestionImagePath,
  getExtensionFromMimeType,
  isStorageConfigured,
  tryDeleteFromStorage,
  validateImageFile,
} from "@/lib/storage"
import { consumeUploadRateLimit } from "@/lib/upload-rate-limit"
```

Dans `setQuestionImages`, remplace l'appel de suppression :

```ts
if (removedPaths.length > 0) {
  await Promise.all(removedPaths.map((p) => tryDeleteFromStorage(p)))
}
```

Supprime `UploadQuestionImageResult` et toute la fonction `uploadQuestionImage`, et mets à la place (en gardant `QUESTION_ID_RE`) :

```ts
export type CreateQuestionImageUploadResult =
  | {
      success: true
      url: string
      fields: Record<string, string>
      storagePath: string
    }
  | { success: false; error: string }

/**
 * [Admin] Étape 1 de l'upload d'image question : garde admin → questionId validé
 * (anti path-traversal) + existant → validation type/taille → rate-limit (50/h) →
 * presigned POST S3 (`questions/{questionId}/…`). Ne persiste PAS : la liste
 * finale est enregistrée par `setQuestionImages` au save du formulaire. Le fichier
 * ne transite PAS par le serveur.
 */
export const createQuestionImageUpload = async (input: {
  questionId: string
  imageIndex: number
  contentType: string
  size: number
}): Promise<CreateQuestionImageUploadResult> => {
  const session = await requireRole(["admin"])

  if (!QUESTION_ID_RE.test(input.questionId)) {
    return { success: false, error: "Question invalide" }
  }
  const imageIndex = Math.max(
    0,
    Math.min(
      999,
      Number.isFinite(input.imageIndex) ? Math.trunc(input.imageIndex) : 0,
    ),
  )

  const validationError = validateImageFile(input.contentType, input.size)
  if (validationError) return { success: false, error: validationError }

  if (!isStorageConfigured()) {
    return {
      success: false,
      error: "Le téléversement d'images n'est pas configuré.",
    }
  }

  const [q] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, input.questionId), isNull(questions.deletedAt)))
    .limit(1)
  if (!q) return { success: false, error: "Question introuvable" }

  const limit = await consumeUploadRateLimit(session.user.id, "question-image")
  if (!limit.allowed) {
    return {
      success: false,
      error: `Limite d'uploads atteinte. Réessayez dans ${limit.retryAfterMinutes} minute(s).`,
    }
  }

  const storagePath = generateQuestionImagePath(
    input.questionId,
    imageIndex,
    getExtensionFromMimeType(input.contentType),
  )
  try {
    const { url, fields } = await createPresignedUpload(
      storagePath,
      input.contentType,
    )
    return { success: true, url, fields, storagePath }
  } catch (error) {
    logDev("[createQuestionImageUpload]", error)
    return { success: false, error: "Erreur serveur. Réessayez." }
  }
}
```

- [ ] **Step 2: Réécrire la section question des tests d'intégration**

Dans `tests/integration/uploads-actions.test.ts`, remplace tout le `describe("uploadQuestionImage", …)` par :

```ts
describe("createQuestionImageUpload", () => {
  beforeAll(() => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: adminId, role: "admin" },
    } as never)
  })

  it("presign vers un chemin lié au questionId existant", async () => {
    const qid = await seedQuestion()
    const res = await createQuestionImageUpload({
      questionId: qid,
      imageIndex: 0,
      contentType: "image/jpeg",
      size: 1000,
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.storagePath.startsWith(`questions/${qid}/`)).toBe(true)
    }
    expect(vi.mocked(createPresignedUpload)).toHaveBeenCalled()
  })

  it("rejette un questionId malformé sans presign (anti path-traversal)", async () => {
    vi.mocked(createPresignedUpload).mockClear()
    const res = await createQuestionImageUpload({
      questionId: "../../etc/passwd",
      imageIndex: 0,
      contentType: "image/jpeg",
      size: 1000,
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("invalide")
    expect(vi.mocked(createPresignedUpload)).not.toHaveBeenCalled()
  })

  it("rejette un questionId bien formé mais inexistant", async () => {
    const res = await createQuestionImageUpload({
      questionId: createId(),
      imageIndex: 0,
      contentType: "image/jpeg",
      size: 1000,
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toContain("introuvable")
  })
})
```

Supprime aussi en haut du fichier le helper `jpeg` (plus utilisé) et l'import `createId` reste utilisé (seedQuestion). Vérifie qu'il ne reste aucune référence à `uploadToBunny`, `uploadQuestionImage`, `uploadAvatar`, `jpeg`.

- [ ] **Step 3: Mettre à jour le mock de `questions-actions.test.ts`**

Dans `tests/integration/questions-actions.test.ts`, remplace les lignes 17-21 et 34 :

```ts
// Évite tout appel réseau S3 ; `setQuestionImages` délègue la suppression CDN
// des chemins retirés à `tryDeleteFromStorage`.
vi.mock("@/lib/aws", () => ({
  createPresignedUpload: vi.fn(),
  deleteFromS3: vi.fn(),
}))
vi.mock("@/lib/storage", () => ({
  tryDeleteFromStorage: vi.fn().mockResolvedValue(undefined),
}))
```

et l'import :

```ts
import { tryDeleteFromStorage } from "@/lib/storage"
```

puis les deux assertions (lignes ~137, 146-147) :

```ts
vi.mocked(tryDeleteFromStorage).mockClear()
// …
expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledWith("a.jpg")
expect(vi.mocked(tryDeleteFromStorage)).not.toHaveBeenCalledWith("b.jpg")
```

- [ ] **Step 4: Lancer les tests d'intégration**

Run: `bun run test:integration`
Expected: PASS (uploads-actions + questions-actions).

- [ ] **Step 5: Vérifier la compilation**

Run: `bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add features/questions/actions.ts tests/integration/uploads-actions.test.ts tests/integration/questions-actions.test.ts
git commit -m "feat(questions): image upload via presigned POST + S3 delete in setQuestionImages"
```

---

## Phase 4 — Composants client (flux 2 étapes) + gallery

> Pas de tests unitaires pour les uploaders (aucun n'existe aujourd'hui — on garde la parité ; vérification par `bun run check` + smoke E2E en Phase 6). On met à jour le test gallery existant.

### Task 4.1: `question-image-uploader.tsx` — upload 2 étapes

**Files:**

- Modify: `components/admin/question-image-uploader.tsx`

- [ ] **Step 1: Remplacer l'import de l'action**

```ts
import { createQuestionImageUpload } from "@/features/questions/actions"
import { cdnUrl } from "@/lib/cdn"
```

- [ ] **Step 2: Remplacer la boucle d'upload dans `onDrop`**

Remplace le bloc `for (const item of queued) { … }` par :

```ts
for (let i = 0; i < queued.length; i++) {
  const item = queued[i]
  try {
    const presign = await createQuestionImageUpload({
      questionId,
      imageIndex: images.length + i,
      contentType: item.file.type,
      size: item.file.size,
    })
    if (!presign.success) {
      toast.error(presign.error)
      setUploadingImages((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? { ...u, status: "error", error: presign.error }
            : u,
        ),
      )
      continue
    }

    const s3Form = new FormData()
    Object.entries(presign.fields).forEach(([k, v]) => s3Form.append(k, v))
    s3Form.append("file", item.file) // "file" en dernier (exigence S3 POST)

    const s3Res = await fetch(presign.url, {
      method: "POST",
      body: s3Form,
    })
    if (!s3Res.ok) {
      toast.error("Échec du téléversement. Réessayez.")
      setUploadingImages((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, status: "error", error: "Échec S3" } : u,
        ),
      )
      continue
    }

    onImagesChange((prev) => [
      ...prev,
      {
        url: cdnUrl(presign.storagePath),
        storagePath: presign.storagePath,
        order: prev.length,
      },
    ])
    setUploadingImages((prev) => {
      URL.revokeObjectURL(item.preview)
      previewUrlsRef.current.delete(item.preview)
      return prev.filter((u) => u.id !== item.id)
    })
  } catch {
    toast.error("Échec du téléversement. Réessayez.")
    setUploadingImages((prev) =>
      prev.map((u) =>
        u.id === item.id
          ? { ...u, status: "error", error: "Erreur réseau" }
          : u,
      ),
    )
  }
}
```

- [ ] **Step 3: Vérifier compilation + lint**

Run: `bun run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/admin/question-image-uploader.tsx
git commit -m "feat(admin): question image uploader uses presigned POST (2-step direct-to-S3)"
```

### Task 4.2: `avatar-uploader.tsx` — upload 2 étapes + confirm

**Files:**

- Modify: `components/shared/avatar-uploader.tsx`

- [ ] **Step 1: Remplacer l'import de l'action**

```ts
import {
  confirmAvatarUpload,
  createAvatarUpload,
} from "@/features/users/actions"
import { cdnUrl } from "@/lib/cdn"
```

- [ ] **Step 2: Réécrire le corps de `handleSaveCrop`**

Remplace le `try { … } catch { … }` interne par :

```ts
setIsUploading(true)
try {
  const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)

  const presign = await createAvatarUpload({
    contentType: blob.type || "image/jpeg",
    size: blob.size,
  })
  if (!presign.success) {
    toast.error(presign.error)
    return
  }

  const s3Form = new FormData()
  Object.entries(presign.fields).forEach(([k, v]) => s3Form.append(k, v))
  s3Form.append("file", blob, "avatar.jpg") // "file" en dernier

  const s3Res = await fetch(presign.url, { method: "POST", body: s3Form })
  if (!s3Res.ok) {
    toast.error("Échec du téléversement. Réessayez.")
    return
  }

  const confirmed = await confirmAvatarUpload({
    storagePath: presign.storagePath,
  })
  if (!confirmed.success) {
    toast.error(confirmed.error ?? "Erreur serveur. Réessayez.")
    return
  }

  const newUrl = cdnUrl(presign.storagePath)
  setUploadedUrl(newUrl)
  onAvatarChange?.(newUrl)
  toast.success("Photo de profil mise à jour")

  setCropDialogOpen(false)
  setImageSrc(null)
  setCrop({ x: 0, y: 0 })
  setZoom(1)
  router.refresh()
} catch {
  toast.error("Échec du téléversement. Réessayez.")
} finally {
  setIsUploading(false)
}
```

- [ ] **Step 3: Vérifier compilation + lint**

Run: `bun run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/shared/avatar-uploader.tsx
git commit -m "feat(profile): avatar uploader uses presigned POST + confirm step"
```

### Task 4.3: `question-image-gallery.tsx` — retirer les helpers Bunny morts

**Files:**

- Modify: `components/shared/question-image-gallery.tsx`
- Test: `tests/components/QuestionImageGallery.test.tsx`

- [ ] **Step 1: Mettre à jour le test (pass-through d'URL)**

Dans `tests/components/QuestionImageGallery.test.tsx`, change `createMockImages` pour utiliser le CDN réel et ajoute un test de pass-through :

```ts
const createMockImages = (count: number): QuestionImage[] =>
  Array.from({ length: count }, (_, i) => ({
    url: `https://cdn.nomaqbanq.ca/questions/q1/image${i + 1}.jpg`,
    storagePath: `questions/q1/image${i + 1}.jpg`,
    order: i,
  }))
```

Ajoute dans `describe("single image display", …)` :

```ts
    it("sert l'URL telle quelle (aucune transformation CDN)", () => {
      const images = createMockImages(1)
      render(<QuestionImageGallery images={images} />)
      const img = screen.getByTestId("next-image")
      expect(img).toHaveAttribute("src", images[0].url)
      expect(img.getAttribute("src")).not.toContain("?width=")
    })
```

- [ ] **Step 2: Lancer pour voir échouer**

Run: `bun run test -- QuestionImageGallery`
Expected: FAIL (le `src` actuel n'est pas l'URL brute si l'image passe par `getThumbnailUrl` — ou PASS si l'URL `cdn.nomaqbanq.ca` n'est pas transformée ; dans ce cas le test verrouille juste le comportement, ce qui est l'objectif. S'il passe déjà, continue.)

- [ ] **Step 3: Retirer les helpers de `components/shared/question-image-gallery.tsx`**

Supprime les fonctions `getOptimizedUrl` et `getThumbnailUrl` (lignes 30-49) et le commentaire de section associé. Remplace leurs usages :

- `lightboxSlides` :

```ts
const lightboxSlides = allImages.map((img) => ({
  src: img.url,
  alt: `Image ${img.order + 1}`,
}))
```

- image unique (`allImages[0]`) :

```ts
          <Image
            src={allImages[0].url}
            alt="Image de la question"
```

- grille (boucle `displayedImages`) :

```ts
            <Image
              src={image.url}
              alt={`Image ${index + 1}`}
```

- [ ] **Step 4: Lancer pour voir passer**

Run: `bun run test -- QuestionImageGallery`
Expected: PASS

- [ ] **Step 5: Vérifier compilation**

Run: `bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/shared/question-image-gallery.tsx tests/components/QuestionImageGallery.test.tsx
git commit -m "refactor(gallery): drop dead Bunny optimizer helpers, serve raw CDN URLs"
```

---

## Phase 5 — Décommissionnement Bunny + config + docs

### Task 5.1: Supprimer `lib/bunny.ts` et les vars Bunny

**Files:**

- Delete: `lib/bunny.ts`
- Modify: `lib/env/schema.ts`, `lib/cdn.ts`, `tests/lib/env.test.ts`

- [ ] **Step 1: Vérifier qu'aucune référence ne subsiste**

Run: `git grep -n "lib/bunny\|BUNNY_\|tryDeleteFromBunny\|uploadToBunny\|isBunnyConfigured\|NEXT_PUBLIC_BUNNY_CDN_HOSTNAME"`
Expected: aucune occurrence dans `lib/`, `features/`, `components/`, `tests/` (hors docs/specs). Si des occurrences restent (hors docs), corrige-les avant de continuer.

- [ ] **Step 2: Supprimer le fichier**

```bash
git rm lib/bunny.ts
```

- [ ] **Step 3: Retirer les vars Bunny du schéma env**

Dans `lib/env/schema.ts`, supprime les trois champs `BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_API_KEY`, `BUNNY_CDN_HOSTNAME` et le `.refine(...)` Bunny (le bloc dont le message contient « Configuration Bunny incomplète »). Conserve le refine Stripe et le refine AWS S3.

- [ ] **Step 4: Retirer le fallback legacy de `lib/cdn.ts`**

```ts
export const CDN_HOST =
  process.env.NEXT_PUBLIC_CDN_HOSTNAME ?? "cdn.nomaqbanq.ca"
```

- [ ] **Step 5: Lancer tests + compilation**

Run: `bun run test -- env && bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(storage): remove lib/bunny.ts and BUNNY_* env vars (S3 cutover)"
```

### Task 5.2: `next.config.ts` — image domains + retrait du bodySizeLimit

**Files:**

- Modify: `next.config.ts`

- [ ] **Step 1: Retirer `*.b-cdn.net` des `remotePatterns`**

Supprime l'entrée :

```ts
      {
        protocol: "https",
        hostname: "*.b-cdn.net",
      },
```

(Optionnel : ajoute temporairement `{ protocol: "https", hostname: "*.cloudfront.net" }` pour tester avant la bascule DNS ; à retirer ensuite.)

- [ ] **Step 2: Retirer `serverActions.bodySizeLimit`**

Supprime le bloc `serverActions: { bodySizeLimit: "6mb" }` (et son commentaire). L'upload ne passe plus par les Server Actions → retour au défaut, ce qui clôt la dette F1 (les actions publiques n'acceptent plus de corps de 6 Mo). Garde `optimizePackageImports`. Si `experimental` devient vide, laisse `experimental: { optimizePackageImports: [...] }`.

- [ ] **Step 3: Vérifier le build**

Run: `bun run build`
Expected: build OK (pas d'erreur de config).

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "chore(next): drop b-cdn.net image domain and 6mb serverActions limit (closes debt F1)"
```

### Task 5.3: `.env.example` — section AWS S3

**Files:**

- Modify: `.env.example`

- [ ] **Step 1: Remplacer la section Bunny**

Remplace le bloc « Bunny.net » (lignes ~53-61) par :

```bash
# =====================
# AWS S3 + CloudFront (médias : avatars, images de questions)
# =====================
# Auth via Vercel OIDC -> rôle IAM (prod/preview). AWS_REGION à PINNER (Vercel la
# définit dynamiquement sinon). ROLE_ARN + S3_BUCKET vont ensemble (tout-ou-rien).
AWS_REGION=us-east-2
AWS_ROLE_ARN=
S3_BUCKET=
# Dev local UNIQUEMENT (si projet non lié pour `vercel env pull` du token OIDC).
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
# Hôte CDN public pour l'AFFICHAGE des médias (optionnel, défaut : cdn.nomaqbanq.ca).
NEXT_PUBLIC_CDN_HOSTNAME=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): swap Bunny example vars for AWS S3 + CloudFront"
```

### Task 5.4: Docs (AGENTS.md, README.md, règle data-layer)

**Files:**

- Modify: `AGENTS.md`, `README.md`, `.claude/rules/data-layer.md`

- [ ] **Step 1: `AGENTS.md`**
  - Stack : remplace « Bunny CDN » par « AWS S3 + CloudFront ».
  - Gotchas « Image domains » : remplace `*.b-cdn.net` par `cdn.nomaqbanq.ca` (+ `*.cloudfront.net` si gardé).
  - Structure `lib/` : `bunny.ts` → `aws.ts` + `storage.ts`.

- [ ] **Step 2: `README.md`**
  - Table « Media » : `Bunny CDN` → `AWS S3 + CloudFront (avatars, question images)`.
  - Liste `lib/` (ligne ~112) : `bunny` → `aws, storage`.
  - Ligne ~159 (Route handlers) : retire « Bunny uploads » (les uploads sont des Server Actions presigned, pas des route handlers).
  - Ligne ~177 : « Bunny CDN for file storage (`lib/bunny.ts`) » → « AWS S3 + CloudFront for file storage (`lib/storage.ts` + `lib/aws.ts`), uploads via presigned POST ».
  - Tech list (ligne ~243) : `Bunny CDN - Media Storage` → `AWS S3 + CloudFront - Media Storage`.
  - Ligne ~83 (env) : `Bunny CDN` → `AWS S3`.

- [ ] **Step 3: `.claude/rules/data-layer.md`** — ajoute sous Server Actions :

```markdown
- **Upload médias (presigned POST)** : l'upload passe par S3 en direct, pas par
  le serveur. Pattern : Server Action gardé → validation type + rate-limit
  consommé À L'ÉTAPE PRESIGN → `createPresignedUpload(storagePath, contentType)`
  (clé dérivée serveur, non falsifiable). Le client POST le fichier à S3, puis un
  Server Action persiste le `storagePath` (avatars : `confirmAvatarUpload` ;
  images question : `setQuestionImages` au save). Suppression CDN via
  `tryDeleteFromStorage` (best-effort, après commit DB). Voir `lib/aws.ts` /
  `lib/storage.ts`.
```

- [ ] **Step 4: Vérifier**

Run: `bun run check`
Expected: PASS (docs n'affectent pas la compilation ; sanity check global).

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md .claude/rules/data-layer.md
git commit -m "docs: update Bunny -> S3 + CloudFront references (stack, structure, data-layer rule)"
```

### Task 5.5: Suite complète + revue antagoniste

- [ ] **Step 1: Lancer toute la suite**

Run: `bun run check && bun run test && bun run test:integration`
Expected: PASS partout, coverage ≥ 75 %.

- [ ] **Step 2: Générer une revue antagoniste** (préférence projet — boucle de revue après chaque incrément)

Invoque le skill `adversarial-review-prompt` pour produire le prompt de revue hostile à passer dans une session séparée (cible : ce diff de migration ; focus IDOR sur `confirmAvatarUpload`, conditions du presigned POST, fuites de config, oublis de garde/rate-limit, régressions de tests). Sauvegarde sous `docs/superpowers/reviews/2026-06-24-revue-adversariale-migration-s3.md`.

---

## Phase 6 — Migration des données + bascule (runbook manuel)

> À exécuter autour du déploiement du code (Phases 1-5 mergées). Volume < 1 Go → copie one-shot triviale. Prérequis : Phase 0 terminée.

### Task 6.1: Copier Bunny → S3 (rclone)

- [ ] **Step 1: Configurer les remotes rclone**
  - Remote source Bunny : type **FTP** (host `storage.bunnycdn.com`, user = nom de la Storage Zone, pass = mot de passe FTP/Storage de la zone — cf. dashboard Bunny → Storage → FTP & API Access).
  - Remote cible S3 : type **s3**, provider AWS, region `us-east-2`, credentials (clé temporaire admin OU profil local).

- [ ] **Step 2: Copier puis vérifier**

```bash
rclone copy bunny:/ s3:<BUCKET>/ --progress --transfers 16
rclone check bunny:/ s3:<BUCKET>/ --one-way
```

Expected: `0 differences found` (ou seulement des fichiers attendus). Corrige les écarts avant de continuer.

### Task 6.2: Bascule DNS + vérification

- [ ] **Step 1: Abaisser le TTL** de l'enregistrement `cdn.nomaqbanq.ca` (ex. 300 s) chez le registrar, attendre la propagation.
- [ ] **Step 2: Déployer le code S3** en production (merge de la branche + déploiement Vercel ; vars d'env Phase 0.4 présentes).
- [ ] **Step 3: Basculer le DNS** : pointer `cdn.nomaqbanq.ca` (CNAME) du pull zone Bunny vers le _Distribution domain name_ CloudFront (`dxxxx.cloudfront.net`).
- [ ] **Step 4: Copie incrémentale finale** (rattrape les uploads de dernière minute via l'ancien code) :

```bash
rclone copy bunny:/ s3:<BUCKET>/ --progress
```

- [ ] **Step 5: Smoke test prod** :
  - Afficher une page question avec image (lecture via CloudFront).
  - Uploader un nouvel avatar (presign + confirm) → vérifier l'affichage.
  - Uploader une image de question en admin → vérifier l'affichage + l'enregistrement.
  - `curl -I https://cdn.nomaqbanq.ca/<un-objet-existant>` → 200 + `x-content-type-options: nosniff`.

### Task 6.3: Rétention & purge Bunny

- [ ] **Step 1:** Garder Bunny en lecture seule **~2 semaines** (fenêtre de rollback : repointer le DNS vers Bunny si besoin — la base n'a pas changé).
- [ ] **Step 2:** Après la fenêtre : purger la Storage Zone Bunny, supprimer le pull zone, retirer les credentials Bunny de tous les coffres/secrets.

---

## Self-Review (rempli par l'auteur du plan)

**Couverture spec ↔ tâches :**

- Bucket privé + OAC + CloudFront + ACM us-east-1 → Phase 0 (0.1, 0.3). ✅
- Presigned POST (conditions taille/type) → `lib/aws.ts` (2.1) + actions (3.1, 3.2). ✅
- OIDC → rôle IAM (trust + policy least-priv) → Phase 0.2 + `lib/aws.ts`. ✅
- Réutilisation `cdn.nomaqbanq.ca`, zéro migration DB → `lib/cdn.ts` (1.3), bascule DNS (6.2). ✅
- Rate-limit à l'étape presign → 3.1/3.2. ✅
- Ownership avatar (re-vérif préfixe) → `confirmAvatarUpload` (3.1) + test. ✅
- `tryDeleteFromStorage` (orphelins / ancien avatar / images retirées) → 2.2, 3.1, 3.2. ✅
- Retrait code mort Bunny optimizer → 4.3. ✅
- Retrait `bodySizeLimit` (dette F1) → 5.2. ✅
- Migration rclone + cutover + rétention → Phase 6. ✅
- Docs (AGENTS/README/rule/env) → 5.3, 5.4. ✅

**Cohérence des types :** `CreateUploadResult` / `CreateQuestionImageUploadResult` partagent la forme `{ url, fields, storagePath }`. `createPresignedUpload(storagePath, contentType) → { url, fields }`. `confirmAvatarUpload → UpdateProfileResult & { url? }`. `tryDeleteFromStorage(path) → Promise<void>`. `deleteFromS3(path) → Promise<boolean>`. Noms cohérents entre tâches. ✅

**Placeholders :** les `<ACCOUNT_ID>`/`<TEAM_SLUG>`/`<PROJECT>`/`<BUCKET>` sont des paramètres de provisioning explicites (Phase 0/6), pas des TODO de code. ✅

**Note de granularité :** les uploaders client (4.1, 4.2) n'ont pas de tests unitaires — parité avec l'existant (aucun test uploader aujourd'hui) ; couverts par `bun run check` + smoke E2E (6.2). Choix assumé pour éviter la cérémonie (cf. préférence projet).
