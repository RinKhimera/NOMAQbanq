# Design — Migration Bunny → AWS S3 + CloudFront

> Statut : **validé (design)** — 2026-06-24
> Auteur : brainstorming Claude + Samuel
> Remplace : `lib/bunny.ts`, le flux d'upload proxy serveur, et la config Bunny.

## 1. Contexte & objectifs

L'app stocke aujourd'hui les médias (avatars utilisateurs, images de questions)
sur **Bunny Storage** et les sert via **Bunny CDN** (`cdn.nomaqbanq.ca`).
L'upload est un **proxy serveur** : le fichier transite par un Server Action
(Vercel) qui fait un `PUT` vers `storage.bunnycdn.com`.

On migre vers **AWS S3 (us-east-2) privé + CloudFront (OAC)**, avec un upload
**direct navigateur → S3** par **presigned POST**, et une auth AWS par
**Vercel OIDC → rôle IAM** (aucun secret long-vécu).

### Objectifs

- Remplacer Bunny Storage + CDN par S3 privé + CloudFront.
- Upload direct navigateur → S3 (presigned POST) ; le fichier ne transite plus
  par Vercel.
- Auth AWS via Vercel OIDC → rôle IAM (cohérent avec la sécurité « pas de clé
  long-vécue »).
- **Réutiliser le domaine `cdn.nomaqbanq.ca`** → **aucune migration de schéma DB,
  aucun backfill** (cf. §3).
- Migrer les fichiers existants (< 1 Go) par **rclone one-shot + bascule DNS**.

### Non-objectifs (YAGNI)

- ❌ Redimensionnement d'images à la volée côté CDN — on garde `next/image` pour
  les vignettes et on sert l'original (≤ 5 Mo) en lightbox.
- ❌ Migration de SES vers OIDC (faisable plus tard, hors-scope).
- ❌ Double-écriture / coexistence multi-CDN longue durée.

### Décisions actées (brainstorming)

| Décision            | Choix                                                           |
| ------------------- | --------------------------------------------------------------- |
| Mécanisme d'upload  | **Presigned POST** (direct navigateur → S3)                     |
| Auth AWS            | **Vercel OIDC → rôle IAM**                                      |
| Domaine CDN         | **Réutiliser `cdn.nomaqbanq.ca`**                               |
| Bascule             | **Copie one-shot (rclone) + bascule DNS**                       |
| Région S3           | **us-east-2 (Ohio)**                                            |
| Volume actuel       | **< 1 Go** (copie triviale)                                     |
| Optimisation images | **`next/image` + originaux en lightbox** (pas de transform CDN) |

## 2. Architecture cible

```
Upload (écriture) :
  Navigateur ──(1) demande d'autorisation──▶ Server Action (guard + rate-limit + validation type)
           ◀──(2) { url, fields, storagePath } presigned POST (S3, conditions strictes, ~60s)──┘
           ──(3) POST multipart direct──▶ S3 (bucket privé us-east-2)
           ──(4) persistance du storagePath──▶ Server Action ──▶ Neon

Affichage (lecture) :
  Navigateur ──▶ cdn.nomaqbanq.ca (CNAME) ──▶ CloudFront ──(OAC)──▶ S3 privé
                                          (cache long + Brotli/Gzip + nosniff)
```

- **Bucket S3** : privé, _Block Public Access_ activé. Aucune ACL/policy
  publique. Seul CloudFront lit, via une **bucket policy conditionnée sur l'ARN
  de la distribution** (Origin Access Control / OAC).
- **CloudFront** : alias `cdn.nomaqbanq.ca`, certificat **ACM en us-east-1**
  (exigence CloudFront, indépendante de la région du bucket), compression
  activée, _response-headers-policy_ : `Cache-Control` long immutable +
  `X-Content-Type-Options: nosniff`.
- **Layout des clés d'objets identique à Bunny** (clé de la transparence) :
  - `questions/{questionId}/{timestamp}-{index}.{ext}`
  - `avatars/{userId}/{timestamp}.{ext}`

## 3. Modèle de données & compatibilité

Aucune migration Drizzle, aucun backfill, parce que :

- `questionImages.storagePath` stocke le **chemin relatif** ; l'URL d'affichage
  est dérivée à l'exécution par `cdnUrl(storagePath)`. Le domaine ne changeant
  pas, la dérivation reste valide.
- `user.image` stocke l'**URL complète** `https://cdn.nomaqbanq.ca/avatars/...`.
  Le domaine ne changeant pas, les URLs déjà stockées continuent de résoudre
  (vers CloudFront au lieu de Bunny après bascule DNS).

⟹ On copie les octets vers S3 et on bascule le DNS. La base n'est pas touchée.

## 4. Authentification AWS (Vercel OIDC → rôle IAM)

Packages : `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`,
`@vercel/oidc-aws-credentials-provider`.

Client (server-only), dans `lib/aws.ts` :

```ts
import { S3Client } from "@aws-sdk/client-s3"
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider"

const s3 = new S3Client({
  region: process.env.AWS_REGION!, // pinned us-east-2
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN!,
    audience: "sts.amazonaws.com",
  }),
})
```

**IdP OIDC (AWS Console → IAM → Identity Providers)**

- Provider URL : `https://oidc.vercel.com/<TEAM_SLUG>` (issuer mode _Team_).
- Audience : `https://vercel.com/<TEAM_SLUG>` **et** `sts.amazonaws.com` (audience
  custom utilisée par `awsCredentialsProvider`).

**Trust policy du rôle** (scoppée aux environnements server, dev exclu) :

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

**Policy d'autorisation du rôle** (least-privilege — pas de `GetObject`, la
lecture passe par CloudFront) :

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

> ⚠️ `AWS_REGION` est auto-défini par Vercel selon la région d'exécution
> (multi-région / failover). On le **déclare explicitement** dans les env vars
> Vercel = `us-east-2` pour éviter de router les appels vers une mauvaise région.

**Dev local** : `vercel env pull` injecte un `VERCEL_OIDC_TOKEN` (~12 h) que
`awsCredentialsProvider` consomme. Fallback optionnel : clés statiques
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` si le projet n'est pas lié.

## 5. Upload par presigned POST

On utilise **POST** (et non un presigned PUT) car seul le POST policy permet
d'imposer `content-length-range` (taille max garantie côté S3 alors que le
fichier ne passe pas par notre serveur).

```ts
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"

const { url, fields } = await createPresignedPost(s3, {
  Bucket: process.env.S3_BUCKET!,
  Key: storagePath, // dérivé serveur (non falsifiable)
  Expires: 60, // secondes
  Conditions: [
    ["content-length-range", 1, 5 * 1024 * 1024], // 1 o .. 5 Mo
    ["eq", "$Content-Type", contentType], // image/jpeg|png|webp validé serveur
  ],
  Fields: { "Content-Type": contentType },
})
// → renvoyé au client : { url, fields, storagePath }
```

Côté client (flux 2 étapes) :

```ts
const fd = new FormData()
Object.entries(fields).forEach(([k, v]) => fd.append(k, v))
fd.append("file", file) // "file" en dernier (exigence S3 POST)
const res = await fetch(url, { method: "POST", body: fd }) // 204 = OK
```

## 6. Changements de code (par zone)

### Couche stockage

- **Renommer `lib/bunny.ts` → `lib/storage.ts`** :
  - Retirer `uploadToBunny` (plus de proxy).
  - Ajouter `createPresignedUpload(storagePath, contentType)` → `{ url, fields }`.
  - `deleteFromBunny`/`tryDeleteFromBunny` → `deleteFromS3`/`tryDeleteFromStorage`
    (via `DeleteObjectCommand`).
  - Conserver : `generateQuestionImagePath`, `generateAvatarPath`,
    `getExtensionFromMimeType`, `validateImageFile`, `assertSafeStoragePath`.
  - `isBunnyConfigured` → `isStorageConfigured`.
  - `avatarStoragePathFromUrl` : check d'hôte basé sur `NEXT_PUBLIC_CDN_HOSTNAME`
    (au lieu de `BUNNY_CDN_HOSTNAME`), préfixe `avatars/` conservé.
- **`lib/aws.ts` (nouveau)** : `S3Client` + `awsCredentialsProvider`, fabrique du
  presigned POST. `import "server-only"`.
- **`lib/cdn.ts`** : `NEXT_PUBLIC_BUNNY_CDN_HOSTNAME` → `NEXT_PUBLIC_CDN_HOSTNAME`
  (défaut `cdn.nomaqbanq.ca`).

### Server Actions

- **`features/questions/actions.ts`** : `uploadQuestionImage` (proxy) →
  **`createQuestionImageUpload(formData|args)`**. Garde admin + validation
  `questionId` (regex anti-traversal) + existence en base + rate-limit (50/h) +
  validation type/extension **à l'étape presign**. Renvoie
  `{ url, fields, storagePath }`. `setQuestionImages` : suppression CDN des
  chemins retirés → `tryDeleteFromStorage`.
- **`features/users/actions.ts`** : `uploadAvatar` (proxy) →
  **`createAvatarUpload(args)`** (presign : session → rate-limit 5/h → validation
  type → presigned POST sur `avatars/{ownId}/...`) + **`confirmAvatarUpload(storagePath)`**
  (re-vérifie le préfixe `avatars/{ownId}/`, met à jour `user.image` avec
  `cdnUrl(storagePath)`, supprime l'ancien avatar s'il nous appartient).

### Composants client (flux 2 étapes)

- **`components/admin/question-image-uploader.tsx`** : `onDrop` → appelle
  `createQuestionImageUpload` → `POST` multipart vers S3 → sur `204`, ajoute
  `{ url: cdnUrl(storagePath), storagePath, order }` à la liste (persistée au
  save via `setQuestionImages`, inchangé).
- **`components/shared/avatar-uploader.tsx`** : même flux 2 étapes, puis
  `confirmAvatarUpload(storagePath)`.
- **`components/shared/question-image-gallery.tsx`** : retirer
  `getOptimizedUrl`/`getThumbnailUrl` (code mort `b-cdn.net`), servir `img.url`
  direct (vignettes via `next/image`, original en lightbox).

### Config / env

- **`lib/env/schema.ts`** : retirer `BUNNY_STORAGE_ZONE_NAME`,
  `BUNNY_STORAGE_API_KEY`, `BUNNY_CDN_HOSTNAME` + leur `.refine`. Ajouter
  (optionnels) `AWS_REGION`, `AWS_ROLE_ARN`, `S3_BUCKET`,
  `NEXT_PUBLIC_CDN_HOSTNAME`, avec un `.refine` « tout-ou-rien » + message clair à
  l'usage (même pattern que Bunny aujourd'hui). Clés statiques locales
  (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`) optionnelles.
- **`next.config.ts`** : `remotePatterns` retire `*.b-cdn.net`, garde
  `cdn.nomaqbanq.ca` (option : ajouter `*.cloudfront.net` temporairement pour
  tester avant bascule DNS). **Retirer `serverActions.bodySizeLimit: "6mb"`**
  (retour au défaut) → l'upload ne passe plus par les Server Actions, ce qui
  **clôt la dette F1** (les actions publiques `loadRandomQuizQuestions` /
  `scoreQuizAnswers` n'acceptent plus de corps de 6 Mo).
- **`.env.example`**, **`.env.local`** : swap des variables Bunny → AWS.

### Docs

- `AGENTS.md` : gotchas « Image domains », mention upload presigned.
- `.claude/rules/data-layer.md` : note sur le pattern presigned upload + rate-limit
  à l'étape presign.

## 7. Sécurité

- **Taille garantie** par `content-length-range [1, 5 Mo]` (S3), indépendamment
  du client.
- **Clé fixée serveur** (clé exacte, pas un préfixe ouvert) → pas d'écrasement
  d'objets d'autrui, pas de path-traversal. Expiration **~60 s**.
- **Content-Type verrouillé** à `image/jpeg|png|webp` (pas de SVG) via condition
  `["eq", "$Content-Type", …]`. S3 stocke et sert ce type ;
  `X-Content-Type-Options: nosniff` (CloudFront) empêche le navigateur de
  ré-interpréter un fichier en HTML/JS.
  - _Trade-off assumé_ : le presigned upload retire l'inspection des magic bytes
    côté serveur. Le proxy actuel ne la faisait pas non plus (parité). Uploads
    réservés à des admins (images) ou utilisateurs authentifiés (avatars) ; pas
    de SVG ; `nosniff` actif → risque XSS stocké faible.
- **Rate-limit consommé à l'étape presign** (5/h avatar, 50/h images) → non
  contournable en tapant S3 directement (chaque upload exige une policy
  fraîchement signée et expirée à 60 s).
- **IAM least-privilege** : `PutObject` + `DeleteObject` sur `…/questions/*` et
  `…/avatars/*` seulement. Pas de `GetObject` côté app.
- **OIDC trust policy** scoppée `production` + `preview` (dev exclu).
- **Bucket CORS** requis pour l'upload navigateur :

```json
[
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
```

(Origines prod à confirmer ; restreindre les previews si souhaité.)

## 8. Migration & bascule (runbook)

1. **Inventaire** Bunny : lister la Storage Zone (API list), compter objets/octets.
2. **Provision AWS** :
   - Bucket privé `us-east-2`, Block Public Access ON, CORS (§7).
   - IdP OIDC Vercel + rôle IAM (trust + policy, §4).
   - CloudFront + OAC + bucket policy ; certificat ACM `us-east-1` ;
     alias `cdn.nomaqbanq.ca` ; response-headers-policy.
3. **Copie** `rclone copy` Bunny → S3, puis `rclone check` (comptes + sommes).
4. **Vérif hors-prod** : tester quelques objets via le domaine `*.cloudfront.net`.
5. **Déploiement code** (branche S3 : presigned + OIDC) une fois bucket/role en
   place ; env vars Vercel renseignées.
6. **Bascule DNS** : repointer `cdn.nomaqbanq.ca` du pull zone Bunny vers la
   distribution CloudFront (TTL abaissé en amont).
7. **Copie incrémentale finale** (`rclone copy`) pour rattraper d'éventuels
   uploads de dernière minute via l'ancien code.
8. **Rétention Bunny ~2 semaines** (lecture seule, rollback), puis purge des
   objets, retrait des vars/credentials Bunny.

## 9. Tests

- **Intégration** (`tests/integration/uploads-actions.test.ts`,
  `questions-actions.test.ts`) : l'action presign renvoie les bons
  `fields`/conditions ; gardes (admin/session) ; rate-limit ; ownership avatar ;
  `setQuestionImages` appelle `deleteFromS3` sur les chemins retirés. Mock
  `@aws-sdk/client-s3` + `createPresignedPost`.
- **Composant** (`tests/components/QuestionImageGallery.test.tsx`) : la gallery
  rend `img.url` direct (plus de params `b-cdn.net`) ; uploader fait le 2-étapes
  (mock `fetch` S3 → 204).
- **E2E** : avatar + image question (happy path), gardé court (filtre `-g`).
- Seuil coverage 75 % maintenu.

## 10. Rollback

DNS repointable vers Bunny tant que la rétention tient. Le code S3 et la donnée
Bunny coexistent ~2 semaines ; un revert du déploiement + repointage DNS restaure
l'état précédent sans perte (la base n'a pas changé).

## 11. Risques & dette

- **Orphelins** : un upload abandonné avant save laisse un objet S3 (parité avec
  le comportement Bunny actuel). Option future : _lifecycle rule_ S3 expirant les
  objets `questions/*` non référencés au-delà de N jours. → noté en dette, hors
  scope.
- **`AWS_REGION`** auto-défini par Vercel → **pin explicite** `us-east-2`.
- **CORS / origines** : la liste d'`AllowedOrigins` doit couvrir prod + previews +
  local ; à valider au déploiement.
- **Dev local** : dépend de `vercel env pull` pour le token OIDC ; documenter le
  fallback clés statiques.

## 12. Hors-scope

SES → OIDC, transformation d'images côté CDN, multi-CDN, CDN image resizing.

## Sources

- Vercel — Connect to AWS (OIDC) : https://vercel.com/docs/oidc/aws
- Vercel — OIDC reference : https://vercel.com/docs/oidc/reference
- Presigned URLs Next.js App Router (C. Murphy) :
  https://conermurphy.com/blog/presigned-urls-nextjs-s3-upload/
- Neon — upload S3 + références Postgres :
  https://neon.com/guides/next-upload-aws-s3
- rclone — S3 : https://rclone.org/s3/
- AWS — migrer via rclone :
  https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/migrate-data-from-microsoft-azure-blob-to-amazon-s3-by-using-rclone.html
