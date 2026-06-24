# Revue adversariale — cluster « infra / durcissement Phase 7 » (7c + 7d + 7e)

- **Date** : 2026-06-24
- **Scope** :
  - 7c + 7d + 7e — **tous committés** (l'arbre de travail est propre : `git diff HEAD`
    est vide). Range effectif : `git diff 130e9b0..HEAD` = `ef52911` (cron Vercel)
    + `bbd9afa` (uploaders Bunny + Server Actions + audit taint). 18 fichiers.
  - Nouveaux fichiers lus en entier : `lib/bunny.ts`, `lib/crop-image.ts`,
    `lib/upload-rate-limit.ts`, `features/{exams,training}/cron.ts`,
    `app/api/cron/close-expired/route.ts`, `db/schema/ops.ts`,
    `tests/integration/{upload-rate-limit,cron-close-expired,questions-actions}.test.ts`,
    `vercel.json`.
  - Branche : `migration/drizzle-neon` (jamais déployée).
- **Méthode** : lecture seule, hostile, chaque finding prouvé par `fichier:ligne` ;
  parité confrontée au backend Convex encore présent ; chaque bug suspecté soumis à
  réfutation avant rétention (cf. § Faux positifs).
- **Gate** : `bun run check` → **exit 0**. `bun run test` / `test:integration` /
  `build` non lancés (préférence « runs courts » + `test:integration` provisionne
  une branche Neon éphémère ; tests lus, pas exécutés).

---

## 2. Table des findings (triée par sévérité)

| #   | Sév | fichier:ligne | problème | régression ? |
| --- | --- | --- | --- | --- |
| 1 | 🟠 | `tests/integration/questions-actions.test.ts:19-21` · (absence) | Toute la surface neuve `uploadAvatar` / `uploadQuestionImage` ship **sans test direct** (authz, validation, chemin dérivé serveur, ordre rate-limit/upload, cleanup orphelin). Bunny est mocké en bloc. | NON (code neuf) |
| 2 | 🟡 | `features/users/actions.ts:146` · `lib/upload-rate-limit.ts:8-21` | Le slot rate-limit est consommé **avant** l'upload : un échec Bunny brûle un quota → 5 échecs réseau = avatar verrouillé ≤ 1 h. | OUI (Convex n'incrémentait qu'après succès) |
| 3 | 🟡 | `next.config.ts:11-13` | `bodySizeLimit: "6mb"` est **global** : relève le plafond de transport des deux Server Actions **publiques non authentifiées** (`loadRandomQuizQuestions`, `scoreQuizAnswers`) de 1→6 Mo. | NON (config neuve) |
| 4 | 🟡 | `lib/cdn.ts:4-8` vs `lib/bunny.ts:146` | URL d'image de question fraîche = `env.BUNNY_CDN_HOSTNAME` ; au rechargement = `cdnUrl()` = `NEXT_PUBLIC_BUNNY_CDN_HOSTNAME ?? "cdn.nomaqbanq.ca"`. Deux sources d'hôte CDN ; si elles divergent en prod, les images rechargées pointent ailleurs. | NON |
| 5 | ℹ️ | `components/admin/question-image-uploader.tsx:240,274,335` | `URL.createObjectURL` des previews en état `error`/`pending` n'est révoqué qu'au succès ou à l'annulation manuelle : fuite mémoire si le composant démonte avec des items en erreur. | N/A |
| 6 | ℹ️ | `features/users/actions.ts:155-187` | Double upload avatar concurrent (2 onglets) : les deux lisent le même ancien avatar, last-writer-wins en base, l'objet perdant reste orphelin sur le CDN. | N/A |
| 7 | ℹ️ | `app/api/cron/close-expired/route.ts:21-24` · `lib/env/schema.ts:43` | `CRON_SECRET` absent ⇒ route 401 en permanence (fail-closed **correct**) mais le cron ne tourne jamais et rien ne le signale → fermetures auto silencieusement mortes. | N/A |
| 8 | ℹ️ | `features/questions/actions.ts:305-313` · `features/questions/schemas.ts:39-51` | `setQuestionImages` n'attache pas `storagePath` à `questionId` ; un payload admin peut référencer le fichier d'une autre question, dont le retrait ultérieur déclenche `tryDeleteFromBunny` (admin-confiance, donc bas). | N/A |
| 9 | ℹ️ | `lib/bunny.ts:271-285` | `validateImageFile` se fie au `file.type`/`file.size` client (pas de magic-bytes). Neutralisé en pratique (cf. faux positif XSS) ; sniffing serait du durcissement. | NON (parité Convex) |

---

## 3. Détail par finding

### 1 — 🟠 Surface d'upload neuve livrée sans test direct
- **Code** : `tests/integration/questions-actions.test.ts:19-21` mocke `@/lib/bunny`
  intégralement et **n'appelle jamais** `uploadQuestionImage`. `uploadAvatar` n'est
  importé dans aucun test (vérifié par grep `uploadAvatar|uploadQuestionImage` sur
  `tests/` → 0 hit). Seuls sont couverts : `consumeUploadRateLimit` (lib),
  `setQuestionImages` (délégation suppression) et les crons.
- **Pourquoi c'est un vrai défaut** : les chemins les plus sensibles de 7d ne sont
  validés par aucune régression automatisée — garde admin de `uploadQuestionImage`
  (`requireRole(["admin"])`, `features/questions/actions.ts:358`), validation
  `QUESTION_ID_RE` (`:367`), dérivation serveur du `storagePath`, ordre
  existence-question → consume → upload, et surtout le **cleanup orphelin** sur
  échec `db.update` de `uploadAvatar` (`features/users/actions.ts:171-181`) et le
  scoping `avatarStoragePathFromUrl` de la suppression d'ancien avatar. Une
  régression future sur l'un de ces points passerait le CI sans bruit.
- **Régression ?** NON (code neuf), mais c'est le « trou de tests » que la consigne
  vise explicitement.
- **Correctif suggéré** : une suite `tests/integration/upload-actions.test.ts` (Bunny
  mocké) couvrant : (a) `uploadQuestionImage` refuse `questionId` invalide / question
  supprimée sans consommer de slot ; (b) consume **avant** upload (mock Bunny en échec
  → slot déjà brûlé) ; (c) `uploadAvatar` nettoie l'objet si `db.update` jette ;
  (d) `avatarStoragePathFromUrl` ne supprime un ancien avatar que s'il est chez nous
  et sous `avatars/`.

### 2 — 🟡 Slot rate-limit consommé avant l'upload (échec Bunny = quota brûlé)
- **Code** : `features/users/actions.ts:146` (`consumeUploadRateLimit` …) puis `:166`
  (`uploadToBunny`). Idem `features/questions/actions.ts:400` puis `:414`. Tradeoff
  assumé et documenté en tête de `lib/upload-rate-limit.ts:8-21`.
- **Pourquoi c'est un vrai bug (mineur)** : le port Convex (`convex/http.ts:357-426`)
  vérifiait le quota **avant** et n'incrémentait (`incrementUploadCount`) **qu'après**
  un upload réussi. Ici, 5 échecs Bunny consécutifs (réseau, 5xx) verrouillent
  l'avatar pour ≤ 1 h alors qu'aucun upload n'a abouti. Pour l'avatar, `validateImageFile`
  passe avant le consume (`:134` < `:146`) donc seuls les fichiers *valides mais en
  échec réseau* brûlent un slot — risque réel mais étroit, limites généreuses (5/h, 50/h).
- **Régression ?** OUI vs Convex — mais délibérée (l'atomicité ferme le TOCTOU).
- **Correctif suggéré** : acceptable en l'état pour le lancement. Si l'UX gêne :
  re-créditer le slot sur échec `uploadToBunny` (un `UPDATE … count = count - 1` dans
  le chemin d'erreur), ou repasser à consume-après-succès en gardant le verrou.

### 3 — 🟡 `bodySizeLimit: "6mb"` global expose les Server Actions publiques
- **Code** : `next.config.ts:11-13`. Actions sans garde : `loadRandomQuizQuestions`
  (`features/questions/actions.ts:86-91`) et `scoreQuizAnswers` (`:112-135`).
- **Pourquoi c'est un vrai bug (mineur)** : le commentaire affirme « tout est
  auth-gated », ce qui est faux pour ces deux actions publiques. Un anonyme peut
  désormais POSTer jusqu'à 6 Mo (vs 1 Mo) de JSON sur des endpoints non authentifiés.
  `scoreQuizAnswers` borne le **traitement** (`.slice(0, 50)`, `:115`) mais pas le
  **transport** : Next parse 6 Mo avant que l'action ne s'exécute → amplification DoS
  modeste, par requête.
- **Régression ?** NON (plafond neuf).
- **Correctif suggéré** : laisser tel quel (Vercel borne par ailleurs) ou, si on veut
  être strict, ne relever le plafond que là où c'est nécessaire — Next ne supporte le
  réglage qu'au niveau global, donc à défaut ajouter une borne de taille de payload en
  tête des deux actions publiques.

### 4 — 🟡 Hôte CDN dérivé de deux sources distinctes (upload vs affichage)
- **Code** : à l'upload, `uploadToBunny` renvoie `https://${env.BUNNY_CDN_HOSTNAME}/…`
  (`lib/bunny.ts:146`) repris tel quel dans l'uploader (`question-image-uploader.tsx:266-271`).
  Au rechargement/édition, l'URL est reconstruite par `cdnUrl(storagePath)` =
  `NEXT_PUBLIC_BUNNY_CDN_HOSTNAME ?? "cdn.nomaqbanq.ca"` (`lib/cdn.ts:4-8`,
  `question-form-page.tsx:148-153`).
- **Pourquoi c'est un vrai bug (config-dépendant)** : si `BUNNY_CDN_HOSTNAME` (serveur)
  vaut p. ex. `nomaqbanq-media.b-cdn.net` et que `NEXT_PUBLIC_BUNNY_CDN_HOSTNAME` n'est
  pas défini en prod, une image fraîchement uploadée s'affiche via `*.b-cdn.net` puis,
  après rechargement, via `cdn.nomaqbanq.ca`. Les deux hôtes sont dans
  `next.config images.remotePatterns` (donc pas d'erreur next/image), mais si
  `cdn.nomaqbanq.ca` n'est pas un alias valide de la pull zone, les images rechargées
  cassent. Les avatars ne sont pas touchés (affichés via l'URL stockée, pas via `cdnUrl`).
- **Régression ?** NON (`cdnUrl` préexiste ; c'est le double-sourcing qui est fragile).
- **Correctif suggéré** : dériver l'hôte d'une **seule** source. Soit `cdnUrl` lit la
  même valeur que l'upload, soit l'uploader ne conserve pas `result.url` mais
  reconstruit via `cdnUrl(result.storagePath)` pour un rendu cohérent. Documenter que
  `NEXT_PUBLIC_BUNNY_CDN_HOSTNAME` == hôte public de `BUNNY_CDN_HOSTNAME`.

### 5 — ℹ️ Fuite `URL.createObjectURL` sur démontage avec items en erreur
- **Code** : `question-image-uploader.tsx:240` (création), révoqué seulement au succès
  (`:274`) ou à l'annulation manuelle (`:335`). Pas de `useEffect(() => () => …)` de
  nettoyage.
- **Pourquoi** : un upload qui finit en `error`/`pending` laisse son object URL vivant ;
  si l'admin quitte le formulaire sans cliquer « annuler » sur la vignette en erreur,
  l'URL fuit jusqu'au rechargement de page. Impact mémoire faible, surface admin.
- **Correctif suggéré** : effet de nettoyage au démontage révoquant tous les
  `uploadingImages[].preview` restants.

### 6 — ℹ️ Orphelin avatar sous double upload concurrent
- **Code** : `features/users/actions.ts:155` (lecture ancien) → `:166` (upload) →
  `:172` (update) → `:184-187` (suppression ancien).
- **Pourquoi** : deux uploads simultanés (deux onglets) lisent le même `current.image`,
  écrivent chacun leur URL (last-writer-wins), et suppriment tous deux l'ancien commun.
  L'objet du « perdant » reste sur le CDN, référencé par personne, jamais supprimé. Le
  garde client `isUploading` (`avatar-uploader.tsx:101`) bloque le cas même-onglet.
- **Correctif suggéré** : acceptable. Au besoin, un nettoyage périodique des avatars
  orphelins, ou un upload idempotent par contenu.

### 7 — ℹ️ `CRON_SECRET` manquant ⇒ fermetures auto silencieusement inertes
- **Code** : `app/api/cron/close-expired/route.ts:21-24` ; `CRON_SECRET` optionnel
  (`lib/env/schema.ts:43`).
- **Pourquoi** : le fail-closed est **correct** (jamais ouvert), mais si la var est
  oubliée côté Vercel, le cron répond 401 à chaque exécution et **aucune** participation
  d'examen / session d'entraînement expirée ne se ferme — sans autre signal qu'une série
  de 401 dans les logs Vercel.
- **Correctif suggéré** : checklist de déploiement (déjà partiellement dans le JSDoc) +
  éventuellement une alerte Sentry si la route est appelée sans secret configuré.

### 8 — ℹ️ `storagePath` non lié à `questionId` dans `setQuestionImages`
- **Code** : insert direct du `storagePath` client (`features/questions/actions.ts:305-313`) ;
  `setQuestionImagesSchema` ne valide pas le préfixe (`schemas.ts:39-51`).
- **Pourquoi** : un admin malveillant peut « adopter » `questions/<autre>/x.jpg` dans la
  liste d'une autre question ; au retrait ultérieur, `tryDeleteFromBunny` supprimerait
  ce fichier alors que la question d'origine le référence encore. Garde-fou : admin de
  confiance + `assertSafeStoragePath` empêche tout traversal réel dans la suppression.
- **Correctif suggéré** : valider que chaque `storagePath` commence par
  `questions/${questionId}/` côté action.

### 9 — ℹ️ Pas de validation magic-bytes
- **Code** : `lib/bunny.ts:271-285`. Voir aussi le faux positif XSS ci-dessous qui
  explique pourquoi ce n'est **pas** exploitable.
- **Correctif suggéré** (optionnel, durcissement) : sniffer les premiers octets
  (signatures JPEG/PNG/WebP) avant l'upload.

---

## 4. Faux positifs écartés (suspectés → disculpés)

- **IDOR : supprimer l'avatar d'autrui.** Crainte : un user force `user.image` vers
  `avatars/<victime>/…` puis son prochain upload supprime le fichier de la victime.
  **Réfuté** : le seul writer non-OAuth de `user.image` est `uploadAvatar` lui-même
  (`features/users/actions.ts:172`), qui écrit toujours notre propre
  `avatars/<son-id>/…`. `updateProfile` ne touche jamais `image` (`:84-87`) ; l'OAuth
  écrit un hôte externe, rejeté par le contrôle d'hôte de `avatarStoragePathFromUrl`
  (`lib/bunny.ts:244`). `oldPath` ne peut donc viser que l'avatar précédent du user.
  (grep exhaustif des écritures `image:` hors `convex/` confirme : un seul writer.)

- **Path-traversal / SSRF dans `uploadToBunny`.** Crainte : injection `//evil`, `..`,
  changement d'hôte. **Réfuté** : les chemins d'upload sont 100 % générés serveur
  (avatar depuis `session.user.id` ; question depuis `questionId` validé
  `^[A-Za-z0-9_-]{1,64}$`, `features/questions/actions.ts:339,367`, + timestamp), et
  `assertSafeStoragePath` (`lib/bunny.ts:84-95`) rejette préfixe `/`, `..`, `\`, `//`,
  contrôles/espaces. Dans `https://storage.bunnycdn.com/<zone>/<path>`, l'autorité est
  déjà close par le `/` → un `@`/hôte injecté reste un segment de chemin, pas une
  réécriture d'autorité.

- **XSS stocké (SVG/HTML déguisé en image).** **Réfuté** : `image/svg+xml` absent de
  `ALLOWED_MIME_TYPES` (`lib/bunny.ts:267`) ; extension forcée jpg/png/webp
  (`getExtensionFromMimeType`, `:254-261`) ; le fichier est servi depuis une **origine
  CDN distincte** avec un Content-Type dérivé de l'extension, et rendu en contexte
  `<img>`/`<Image>`. Aucune exécution sur l'origine applicative possible.

- **« Édition appelle toujours `setQuestionImages`, même liste vide » casse la
  création.** **Réfuté** : la branche création garde `if (imagePayload.length > 0)`
  (`question-form-page.tsx:231`) **et** l'uploader n'est rendu qu'en mode édition
  (`:356`) → en création `images` est toujours vide. Aucune écriture vide parasite,
  aucun orphelin.

- **`neon-http` incapable de faire `SELECT … FOR UPDATE` transactionnel.** **Réfuté** :
  `db/index.ts:2,9,14` utilise `drizzle-orm/node-postgres` sur un vrai `pg.Pool`
  (`max: 5`) — transactions interactives et verrous de ligne supportés. Le
  `Promise.all` de deux transactions dans la route cron tient dans le pool.

- **Course à la première insertion du rate-limit.** **Réfuté** : `onConflictDoNothing`
  garantit la ligne (`lib/upload-rate-limit.ts:50-55`), puis `SELECT … .for("update")`
  (`:58-72`) sérialise les consommateurs concurrents ; le test couvre limite + reset
  fenêtre (`tests/integration/upload-rate-limit.test.ts`).

- **Cron clobbe une vraie soumission (TOCTOU).** **Réfuté** : l'UPDATE est gardé
  `status='in_progress'` et compte les lignes réellement modifiées
  (`features/exams/cron.ts:76-83` ; `features/training/cron.ts:63-70`). Une soumission
  concurrente bascule le statut d'abord → l'UPDATE cron est un no-op. (Le cron Drizzle
  filtre même les expirés directement en SQL, plus correct que le port Convex qui
  prenait 500 `in_progress` toutes échéances confondues.)

- **`getCurrentSession`/`requireSession` fait fuiter `session.token` au client.**
  **Réfuté sur le périmètre lu** : les actions n'extraient que `session.user.id`/`role`
  (`features/users/actions.ts:127`, `features/questions/actions.ts:400`) ; aucune
  session brute passée en prop client. La discipline « colonnes ciblées / session non
  propagée » est consignée dans `.claude/rules/data-layer.md` et tenue dans le code lu.
  (Audit exhaustif de tous les DAL hors scope, mais le motif tient.)

---

## 5. Verdict

**Empiler la purge finale Convex (suppression `convex/`, désinstallation `@clerk/*` +
`convex`, retrait du shim provider) sur ce cluster : OUI.**

Aucun bloquant 🔴/🟠 que la purge aggraverait. Les ports Bunny (upload/delete/paths/
validation), rate-limit (atomique, TOCTOU fermé) et crons (fail-closed, idempotents)
sont fidèles à Convex, voire plus durs. Les chemins sensibles (dérivation serveur du
`storagePath`, authz admin/session, scoping de la suppression d'avatar) résistent à
l'attaque. Crons + uploads ne dépendent plus de `convex/` — la purge est sûre.

Le seul 🟠 (trou de tests sur les actions d'upload) est à combler **avant la bascule
prod**, pas avant la purge.

### Table de correctifs priorisée

| Priorité | Action |
| --- | --- |
| **Bloquant maintenant (avant purge)** | Aucun. |
| **Avant bascule prod** | (1) Tests d'intégration `uploadAvatar`/`uploadQuestionImage` (authz, validation, chemin serveur, consume-avant-upload, cleanup orphelin). (7) Définir `CRON_SECRET` côté Vercel + confirmer plan Pro (cron horaire). (4) Aligner `BUNNY_CDN_HOSTNAME` (upload) et `NEXT_PUBLIC_BUNNY_CDN_HOSTNAME`/défaut `cdnUrl` (affichage) sur le même hôte. |
| **Polish** | (5) Effet de nettoyage des object URLs au démontage. (2) Re-créditer un slot rate-limit sur échec Bunny (ou consume-après-succès). (8) Valider le préfixe `questions/${questionId}/` dans `setQuestionImages`. (9) Validation magic-bytes. (6) Stratégie orphelins avatar. |

---

## 6. Confirmations de sûreté opérationnelle

- **Lecture seule** : aucun fichier source modifié ; seul ce rapport a été écrit.
- **Prod Neon intouchée** : aucune connexion ni requête vers la branche `production`
  (`br-blue-moon-adhu1l69`) ; aucun outil Neon/SQL invoqué.
- **Secrets** : `.env.local` / `.env*` jamais lus ni imprimés. Aucune valeur d'API key
  affichée (seuls les **noms** de variables sont cités).
- **Bunny** : aucun upload/delete réel — `lib/bunny.ts` et `convex/lib/bunny.ts` lus,
  jamais exécutés.
- **Commandes** : seule la gate `bun run check` lancée (exit 0). Aucune commande
  destructive, aucun déploiement, aucun `git` mutant. Tests d'intégration (branche Neon
  éphémère) lus mais non exécutés.
