# Revue antagoniste — correctifs post-migration S3

## 1. En-tête

- **Date** : 2026-06-25
- **Périmètre** : `git diff 8b797eb..HEAD` sur la branche `migration/drizzle-neon`.
- **⚠️ HEAD a bougé pendant la revue.** La tâche désignait 7 commits jusqu'à
  `1284b9d`. Un 8ᵉ commit a atterri **en cours de revue** :
  `25a1ab5 fix(storage): renommer AWS_REGION -> S3_REGION (var réservée Vercel/Lambda) [F3]`.
  HEAD = **`25a1ab5`**. Toutes les citations ci-dessous pointent l'état à `25a1ab5`.
- **Méthode** : lecture seule, hostile, chaque finding prouvé en lisant le code
  (`fichier:ligne`), chaque bug suspecté soumis à une tentative de réfutation
  avant d'être gardé. Aucune source modifiée.
- **Statut gate** : `bun run check` (`tsc --noEmit && eslint --max-warnings 0`)
  → **exit 0** (relancé sur HEAD stable `25a1ab5`). `bun run test` (frontend) →
  **exit 0**. `bun run test:integration` **non lancé** (coût branche Neon éphémère).

> **Note de contexte.** Une revue antérieure existe
> (`docs/superpowers/reviews/2026-06-24-revue-adversariale-s3-auth-ux.md`) et avait
> déjà identifié le risque `AWS_REGION` sous le tag **F3**. Le commit `25a1ab5` est
> précisément le correctif de ce F3. La présente revue le confirme **résolu à HEAD**.

---

## 2. Tableau des findings (trié par sévérité)

| #   | Sév | fichier:ligne                                                | problème                                                                                                                                  | régression ?                 |
| --- | --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | 🟠  | `lib/aws.ts:46-50` (vs `1284b9d`)                            | `AWS_REGION` (var réservée Vercel/Lambda) cassait **toute** opération S3 en prod jusqu'à `25a1ab5`. Discipline de merge.                  | OUI (corrigée par `25a1ab5`) |
| 2   | 🟡  | `features/questions/actions.ts:310-316,341-349`              | `setQuestionImages` ne confine PAS la clé finale à `questions/{questionId}/` ; `assertSafeStoragePath` sauté pour les chemins non-`tmp/`. | NON                          |
| 3   | 🟡  | `lib/aws.ts:31-42` + `lib/env/schema.ts:73-89`               | Clés statiques **prioritaires** sur l'OIDC, sans garde code : posées par erreur sur Vercel → OIDC court-circuité en silence.              | NON                          |
| 4   | 🟡  | `tests/integration/questions-actions.test.ts:162-204`        | Trou de test : la branche « copie OK puis DB échoue → nettoyage des finaux » et le rejet d'un `storagePath` hostile ne sont pas couverts. | N/A                          |
| 5   | ℹ️  | `scripts/migrate-media-to-s3.ts:133-137` + doc plan obsolète | `--dry-run` ne peut pas reporter « absent de Bunny » ; doc plan obsolète instruit encore `vercel env add AWS_REGION`.                     | NON                          |

Aucun finding 🔴 à HEAD `25a1ab5`.

---

## 3. Détail par finding

### Finding 1 — 🟠 `AWS_REGION` réservé Vercel/Lambda (corrigé par `25a1ab5` ; vérifier le SHA mergé)

- **Code** : à `1284b9d`, `lib/aws.ts` faisait `new S3Client({ region: env.AWS_REGION })`
  et `lib/env/schema.ts` déclarait le champ `AWS_REGION` exclu du refine S3. À HEAD
  `25a1ab5`, c'est `lib/aws.ts:46-50` (`env.S3_REGION`), `lib/storage.ts:19-24`,
  `lib/env/schema.ts:55,73-89`, `scripts/migrate-media-to-s3.ts:48,176` — tous en
  `S3_REGION`, cohérents.
- **Pourquoi c'est un vrai bug** : sur Vercel (Lambda), `AWS_REGION` est une variable
  **réservée du runtime** = région d'exécution de la fonction. Une `AWS_REGION`
  définie comme env var applicative est écrasée par le runtime ; le client S3 signe
  alors pour la mauvaise région → **403 / SignatureDoesNotMatch sur tous les presign,
  copy et delete**. Concrètement : tous les uploads avatar + images de question
  cassés en prod. Le déclencheur est le déploiement Vercel lui-même, pas une entrée
  utilisateur. **Vérifié résolu** : `grep AWS_REGION` sur le code applicatif ne
  retourne plus que des commentaires/docs (aucun `env.AWS_REGION`), et `bun run check`
  passe (le champ `AWS_REGION` n'existe plus dans `ServerEnv`, donc toute référence
  résiduelle serait une erreur tsc).
- **Régression ?** **OUI** — introduite par la migration S3, absente du flux Bunny ;
  corrigée par `25a1ab5`.
- **Correctif suggéré** : aucun correctif code requis (déjà fait). **Action
  opérationnelle** : s'assurer que le merge vers `main` inclut **`25a1ab5` ou
  ultérieur**, et NON le tip d'origine `1284b9d` (qui réintroduirait le bug). Sur
  Vercel, poser `S3_REGION=us-east-2` (PAS `AWS_REGION`) — déjà acté dans la
  checklist de bascule (`production-cutover-checklist.md:13-16`).

### Finding 2 — 🟡 Clé finale non confinée à `questions/{questionId}/` (écart au pattern anti-IDOR)

- **Code** : `features/questions/actions.ts:310-316` — la boucle de copie fait
  `if (!p.tmpPath) continue`, donc `assertSafeStoragePath` n'est **jamais appelé pour
  un chemin non-`tmp/`** ; `:341-349` insère `storagePath: p.finalPath` sans vérifier
  que `finalPath` commence par `questions/${questionId}/`.
- **Pourquoi c'est un vrai bug** : la convention `.claude/rules/data-layer.md:48-52`
  exige que `confirmAvatarUpload` re-vérifie le préfixe `avatars/{ownId}/`
  (anti-IDOR) — et c'est fait (`features/users/actions.ts:183-188`,
  `AVATAR_PATH_RE` + `startsWith`). L'équivalent image-question n'a **aucun** garde de
  préfixe analogue. Un `storagePath` hostile `tmp/questions/{AUTRE_ID}/x.jpg` passe
  `assertSafeStoragePath` (pas de `..`/`//`) et fait copier/persister dans le dossier
  d'une **autre** question ; un chemin non-`tmp/` arbitraire est persisté sans aucune
  validation de forme. **Réfutation tentée** : le presign est dérivé serveur
  (`createQuestionImageUpload` → `generateQuestionImageTmpPath`), l'action est
  `requireRole(["admin"])`, et `finalPathFromTmp` ne retire que le préfixe `tmp/` —
  la destination reste donc toujours sous `questions/...` pour une source `tmp/`
  légitime. L'exploitation suppose un admin déjà de confiance. **Survie** : reste un
  écart réel à la défense-en-profondeur documentée + une absence de validation sur la
  branche non-`tmp/`. Sévérité maintenue à 🟡 (non exploitable en pratique, admin-only).
- **Régression ?** **NON** — l'ancien flux persistait déjà `img.storagePath` client
  sans confinement.
- **Correctif suggéré** : avant insertion, asserter **tout** `finalPath` (sortir le
  `continue` du chemin de validation) et exiger
  `finalPath.startsWith(\`questions/${questionId}/\`)`; sinon`fail("Chemin invalide")`.

### Finding 3 — 🟡 Clés statiques prioritaires sur l'OIDC sans garde code

- **Code** : `lib/aws.ts:31-42` — `resolveCredentials` teste `AWS_ACCESS_KEY_ID &&
AWS_SECRET_ACCESS_KEY` **en premier**, l'OIDC (`AWS_ROLE_ARN`) seulement ensuite.
  `lib/env/schema.ts:73-89` — le refine accepte `AWS_ROLE_ARN` **OU** les clés
  statiques, mais n'interdit pas d'avoir les deux.
- **Pourquoi c'est un vrai bug (durcissement)** : si `AWS_ACCESS_KEY_ID/SECRET`
  atterrissent un jour sur Vercel prod/preview (copier-coller depuis `.env.local`,
  héritage d'env), elles **priment silencieusement** sur le rôle IAM OIDC — on perd
  le bénéfice « aucun secret long-vécu en prod » sans aucun signal. **Réfutation
  tentée** : la checklist de bascule (`production-cutover-checklist.md:13-16`) dit
  explicitement « clés statiques **uniquement** en local, jamais sur Vercel », et
  c'est un choix pragmatique assumé (cf. mémoire projet). **Survie** : la garde est
  _documentaire_, pas _codée_ ; rien n'empêche la config dangereuse au runtime.
- **Régression ?** **NON** — capacité nouvelle (commit `938c42b`), additive.
- **Correctif suggéré** (optionnel) : en prod/preview Vercel (`process.env.VERCEL`),
  préférer l'OIDC et/ou refuser les clés statiques au chargement env (refine :
  `!(VERCEL && AWS_ACCESS_KEY_ID)`), ou au minimum `console.warn` si les deux sont
  présentes. Pas de fuite de secret côté logs : `resolveCredentials` lève un message
  générique (`lib/aws.ts:37-39`) et les erreurs SDK ne portent pas la clé secrète.

### Finding 4 — 🟡 Trous de tests sur le chemin anti-orphelins et le path-safety

- **Code** : `tests/integration/questions-actions.test.ts:162-204` couvre (a) la copie
  `tmp/→questions/` heureuse + persistance du chemin final + nettoyage `tmp/`, et
  (b) « image déjà finale → pas de copie ». **Non couvert** :
  1. La branche **copie OK puis transaction DB échoue → suppression des finaux
     copiés** (`features/questions/actions.ts:366-368`) — c'est exactement la garantie
     anti-orphelins « approche C », et elle n'est jamais exercée.
  2. Le **rejet d'un `storagePath` hostile** (`tmp/../…`, `//`, contrôle) par
     `assertSafeStoragePath` dans `setQuestionImages`.
- **Pourquoi c'est un vrai bug** : le code de la branche d'échec **paraît correct**
  (lecture : le `catch` supprime bien `copiedFinalPaths`), mais rien ne verrouille ce
  comportement contre une régression future. De plus, `QuestionFormPage.test.tsx:58-74`
  **stubbe entièrement le Radix Select** (l'environnement happy-dom ne le monte pas
  fidèlement) : le test verrouille le _contrat de valeur synchrone_ (`data-value`),
  pas le rendu Radix réel qui était la cause du Bug 1 — garantie plus faible que ce
  que le titre laisse croire (le fix lui-même a été vérifié navigateur, c'est noté
  dans le commentaire).
- **Régression ?** N/A (couverture, pas comportement).
- **Correctif suggéré** : ajouter un test intégration où `copyInS3` réussit mais la
  transaction lève (ex. `questionId` soft-deleted entre presign et save) et asserter
  `tryDeleteFromStorage(finalPath)` appelé ; + un test `setQuestionImages` avec
  `storagePath: "tmp/../questions/x.jpg"` → `success:false` et `copyInS3` non appelé.

### Finding 5 — ℹ️ `--dry-run` n'identifie pas les « absents de Bunny » + doc plan obsolète

- **Code** : `scripts/migrate-media-to-s3.ts:133-137` — `migrateOne` fait
  `if (DRY_RUN) return "copied"` **avant** `downloadFromBunny`. Le `--dry-run` ne peut
  donc jamais classer une clé en `missing` : son compteur « à copier » inclut
  silencieusement des objets absents de Bunny.
- **Pourquoi c'est un vrai bug (mineur)** : inexactitude de reporting au dry-run — un
  opérateur peut croire que N objets seront copiés alors que certains 404 sur Bunny.
  **Réfutation tentée** : `--dry-run` n'écrit effectivement **rien** (le seul appel
  réseau est `existsOnS3` = `HeadObjectCommand`, lecture seule ; ni `PutObject` ni GET
  Bunny) — confirmé sûr. **Survie** : le défaut est l'imprécision du compte, pas une
  écriture.
- **Doc** : `docs/superpowers/plans/2026-06-24-bunny-to-s3-cloudfront-migration.md:192-193`
  instruit encore `vercel env add AWS_REGION production` — suivre ce doc _obsolète_
  pendant la bascule poserait la mauvaise var (non lue par le code) → S3 non configuré.
  La checklist canonique (`production-cutover-checklist.md`) est correcte ; le plan
  l'est plus.
- **Régression ?** **NON** (script neuf).
- **Correctif suggéré** : au dry-run, faire quand même un HEAD Bunny (ou un GET léger)
  pour distinguer copied/missing ; et nettoyer/annoter le plan obsolète pour pointer
  vers la checklist.

---

## 4. Faux positifs écartés (suspecté → écarté, avec preuve)

| Suspicion                                                                          | Écartée parce que                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Orphelin dans `questions/` si copie OK puis insert DB échoue**                   | Le `catch` supprime `copiedFinalPaths` (`features/questions/actions.ts:366-368`). Orphelin seulement en **double-faute** (DB échoue **et** delete S3 échoue) — best-effort, acceptable. Réfuté.                                                                                                                                                                    |
| **`copyInS3` avale les erreurs au lieu de lever**                                  | `lib/aws.ts:93-105` : aucun try/catch, `await send(CopyObjectCommand)` propage. Le commentaire « lève en cas d'échec » est exact. L'appelant gère (`actions.ts:317-321`). Réfuté.                                                                                                                                                                                  |
| **Path-traversal sur la clé finale (`tmp/../questions/autre/x`)**                  | `assertSafeStoragePath` est appelé sur `tmpPath` **et** `finalPath` **avant** `copyInS3` (`actions.ts:312-313`) ; il bloque `..`, `//`, `\`, leading `/`, contrôle. La traversée ne passe pas. (Le confinement préfixe = Finding 2.)                                                                                                                               |
| **XSS/SSRF via `resolveAvatarUrl` (data:/`//host`/http absolu passés tels quels)** | L'avatar est rendu via `next/image` (`avatar-uploader.tsx:180`), dont l'allowlist `remotePatterns` (`next.config.ts`) bloque les hôtes arbitraires (400). Un `data:`/SVG en contexte `<img>` n'exécute pas de script. Le pass-through d'URL absolue est **identique au comportement antérieur** (les URL complètes étaient déjà utilisées telles quelles). Réfuté. |
| **`user.image` arbitrairement contrôlable = vecteur**                              | `image` n'est pas verrouillé (`input:false`) côté Better Auth, donc modifiable via `updateUser` — mais le seul point de rendu (next/image + allowlist) neutralise. Hors périmètre (comportement non modifié par ces commits). Réfuté.                                                                                                                              |
| **Régression de save : Select domaine non pré-rempli en création / état perdu**    | Création = `buildDefaultValues(undefined)` → defaults vides ; édition = montage de `QuestionForm` **après** chargement, `defaultValues` synchrones + `key={question.id}` (remount propre) ; `router.push` après save → pas de reset in-place nécessaire (`question-form-page.tsx:120-135,242-318`). Réfuté.                                                        |
| **`useCurrentUser` fuit de la donnée sensible au client**                          | Ne fait que spread l'objet `data.user` Better Auth (id/name/email/image/role/username/bio) + résoudre `image` (`hooks/useCurrentUser.ts:13-21`) ; aucun token/`session.session` propagé. Forme inchangée. Réfuté.                                                                                                                                                  |
| **`avatarKey` du script migre des URL Google**                                     | `scripts/migrate-media-to-s3.ts:76-87` : `null` si `hostname !== CDN_HOST` et si hors préfixe `avatars/`. Google (`lh3.googleusercontent.com`) → `null`. Réfuté.                                                                                                                                                                                                   |
| **Couverture des sources média par le script**                                     | `collectKeys` (`:89-111`) lit `question_images.storage_path`, `question_explanations.image_path` (WHERE NOT NULL) et `user.image`. Les trois sources attendues sont couvertes. Réfuté.                                                                                                                                                                             |

---

## 5. Verdict

**Est-il sûr de merger ces correctifs vers `main` et de procéder à la bascule prod ?**

> **OUI — à condition que le merge inclue le commit `25a1ab5` (ou ultérieur), et NON
> le tip d'origine `1284b9d`.** Aucun bloquant 🔴 ne subsiste à HEAD `25a1ab5` : la
> gate passe (tsc + eslint + tests frontend), et le seul vrai bug de correction
> (Finding 1, `AWS_REGION`) est **déjà corrigé** par `25a1ab5`. Les findings restants
> sont du durcissement (🟡) ou de l'info (ℹ️), pas des bloquants.

**Bloquants** : aucun au sens code. Le **seul impératif** est une discipline de merge
(inclure `25a1ab5`) — sinon le footgun `AWS_REGION` revient et casse 100 % des
opérations S3 en prod.

### Correctifs priorisés

| Priorité                | Finding | Action                                                                                                                               |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Bloquant maintenant** | 1       | Confirmer que la branche mergée pointe `25a1ab5`+ (pas `1284b9d`). Sur Vercel : `S3_REGION=us-east-2`, **pas** `AWS_REGION`.         |
| **Avant cutover**       | 2       | Confiner `finalPath` à `questions/{questionId}/` + asserter tous les chemins (y compris non-`tmp/`) dans `setQuestionImages`.        |
| **Avant cutover**       | (infra) | Vérifier (déjà dans la checklist) : règle **Lifecycle S3 `tmp/` (expire 1 j)** active + IAM `tmp/*` — sans elle, le tmp/ s'accumule. |
| **Polish**              | 3       | Garde code « pas de clés statiques sur Vercel » (refine ou warn), au-delà de la consigne documentaire.                               |
| **Polish**              | 4       | Tests : branche copie-OK-puis-DB-échoue (nettoyage finaux) + rejet `storagePath` hostile dans `setQuestionImages`.                   |
| **Polish**              | 5       | Dry-run distingue `missing` ; annoter le plan obsolète (`…-migration.md`) vers la checklist canonique.                               |

---

## 6. Confirmations de sûreté opérationnelle

- **Lecture seule respectée** : aucune source modifiée. Seul fichier écrit = ce
  rapport (`docs/superpowers/reviews/2026-06-25-revue-adversariale-correctifs-s3.md`),
  **non commité** (artefact jetable).
- **Commandes exécutées** : `git log/diff/show/status` (lecture), `grep`, `bun run
check` (×2, exit 0), `bun run test` (frontend, exit 0).
- **NON exécuté** : `bun run test:integration` (créerait/détruirait une branche Neon
  éphémère). Aucune commande de déploiement/destructive.
- **NON touché** : branches Neon `develop`/`production`, bucket S3, env Vercel. Le
  contenu de `.env.local`/`.env*` n'a **jamais** été imprimé (seuls les _noms_ de vars
  via `.env.example` / `git show`).
- **Mise en garde** : la revue s'est faite sur un HEAD **mouvant** (le commit `25a1ab5`
  a été créé par un travail parallèle pendant la revue). Toutes les conclusions valent
  pour HEAD `25a1ab5` ; re-confirmer le SHA exact au moment du merge.
