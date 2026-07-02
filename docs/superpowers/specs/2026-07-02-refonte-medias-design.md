# Refonte du sous-système médias — avatars, images de question, cycle de vie S3

> Design validé le 2026-07-02. Branche : `dev-2`. Conception seule — implémentation
> après validation du plan.

## Objectif

Trois axes liés : (A) un composant avatar unique qui couvre toutes les formes de
`user.image` ; (B) une politique de suppression des questions tranchée (hybride
hard/soft) avec cascade des médias ; (C) un cycle de vie S3 sans accumulation
d'orphelins, outillé pour auditer dev et prod.

**Hors périmètre** : `avatar-uploader.tsx` (déjà correct : `resolveAvatarUrl` +
`next/image`, cas à part de préview/crop) ; le flux `setQuestionImages` (tampon
`tmp/` → copie → nettoyage, déjà anti-orphelins) ; toute UI de restauration de
question (suppression **définitive** du point de vue métier) ; migration/backfill
des données (aucun nécessaire).

## État des lieux vérifié (2026-07-02)

Constat de la session précédente confirmé dans le code, avec 3 écarts :

- `user.image` est polymorphe : URL Google/CDN absolue, `data:`, ou **clé S3
  brute** (héritage migration Bunny→S3 du 2026-06-25). Patch `e48404b` =
  normalisation dans le primitif `components/ui/avatar.tsx` via
  `resolveAvatarUrl` (`lib/cdn.ts:13`).
- **Écart 1** : `app/(admin)/admin/utilisateurs/_components/user-details-dialog.tsx`
  rend `user.image` brut via `next/image` (non couvert par le patch) — mais c'est
  du **code mort** (jamais importé). À supprimer.
- **Écart 2** : seules les images d'**énoncé** passent par `next/image`
  (`QuestionImageGallery`) ; les images d'**explication** sont un `<img>` brut
  (`components/quiz/question-card/index.tsx:126`). Sans impact sur ce design.
- **Écart 3 (positif)** : `confirmAvatarUpload` et `setQuestionImages` nettoient
  déjà le nouvel objet S3 si l'écriture DB échoue.
- Au remplacement d'avatar, `avatarStoragePathFromUrl` (`lib/storage.ts:117`)
  ne reconnaît ni clé brute ni host CDN différent → **l'ancien objet n'est jamais
  supprimé** (orphelin). Confirmé.
- `deleteQuestion` = soft delete pur, aucun nettoyage S3, aucune restauration.
  FK vers `questions.id` : `exam_questions`/`exam_answers`/
  `training_session_items` en `onDelete: restrict` ;
  `question_explanations`/`question_images` en `cascade`. Confirmé.
- **Fait déterminant** : `features/exams/dal.ts` ne filtre **jamais** `deletedAt`
  → une question soft-deleted reste servie (passation d'un examen en fenêtre ET
  correction des examens passés, images comprises). Idem relecture d'une session
  d'entraînement existante. ⇒ interdit de nettoyer S3 au soft delete.

## Décisions

| #   | Sujet                        | Décision                                                                                         |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Composant avatar             | `<UserAvatar>` dédié (`components/shared/`), primitif `ui/avatar.tsx` **revenu au stock shadcn** |
| 2   | next/image pour les avatars  | Non — `<img>` Radix (fallback natif sur erreur, support `data:`, pas de quota)                   |
| 3   | Backfill `user.image` legacy | Aucun — rendu host-agnostique au rendu + fix du delete au remplacement                           |
| 4   | Suppression de question      | **Hybride** : hard delete si jamais référencée (arbitré par FK, code 23001), sinon soft          |
| 5   | Restauration                 | Aucune (définitif métier) ; le soft delete n'est qu'une protection d'intégrité                   |
| 6   | S3 au soft delete            | Médias **conservés** (encore servis via les examens/entraînements référents)                     |
| 7   | Orphelins résiduels          | Script d'audit/GC ponctuel, dry-run par défaut — pas de cron                                     |
| 8   | Audit prod                   | Branche Neon éphémère (DB) + dry-run avec creds S3 de liste read-only                            |

## A. Composant `<UserAvatar>`

Nouveau `components/shared/user-avatar.tsx` (client) :

```tsx
type UserAvatarProps = {
  name: string | null | undefined
  image: string | null | undefined
  className?: string // taille/ring/border du conteneur (ex. "size-8")
  fallbackClassName?: string // gradient/couleurs du fallback, propres à chaque site
}
```

- Rend `Avatar` + `AvatarImage src={resolveAvatarUrl(image) ?? undefined}` +
  `AvatarFallback` avec initiales via **`getInitials` de `lib/utils.ts`**
  (helper canonique déjà partagé et testé — 28 cas ; correction post-revue : la
  logique n'était PAS « dupliquée dans ~11 sites », 6 sites importaient déjà ce
  helper ; seules 3 copies locales/inline subsistent et sont supprimées par la
  migration).
- Cas couverts : `null`/vide → initiales ; clé brute `avatars/…` → URL CDN de
  l'env courant ; URL absolue (Google, CDN, autre) → passthrough ; `data:` →
  passthrough ; échec de chargement (404, réseau) → fallback initiales (natif
  Radix, rien à coder).
- `alt` = `name ?? ""`.

Chantiers associés :

1. **Revert du patch `e48404b`** : `components/ui/avatar.tsx` redevient stock
   shadcn (plus de couplage `ui/` → `lib/cdn`, plus de diff à re-porter aux mises
   à jour shadcn).
2. Migration mécanique des **12 sites** vers `<UserAvatar>` :
   `components/shared/generic-nav-user.tsx`,
   `components/marketing-header/{index,mobile-menu}.tsx`,
   `app/(admin)/admin/utilisateurs/_components/{user-side-panel,user-table-row,users-table}.tsx`,
   `app/(admin)/admin/utilisateurs/[id]/_components/user-info-card.tsx`,
   `app/(admin)/admin/examens/[id]/_components/{exam-leaderboard,eligible-candidates-section,restricted-audience-section}.tsx`
   (le dernier est fallback-only — `image={null}`, `ExamAudienceUser` ne porte
   pas d'image),
   `app/(admin)/admin/examens/[id]/resultats/[userId]/_components/participant-results-error.tsx`,
   `components/quiz/results/session-results.tsx`.
3. Suppression du code mort `user-details-dialog.tsx`.

## B. Remplacement d'avatar — fix de l'orphelin

`avatarStoragePathFromUrl` (`lib/storage.ts`) élargi et renommé
`avatarStoragePathFromImageValue` :

- valeur = clé brute commençant par `avatars/` → retournée telle quelle ;
- valeur = URL http(s) dont le pathname (décodé, `/` initial retiré) commence
  par `avatars/` → path extrait **quel que soit le host** ; les URLs Google
  sont exclues naturellement (leur path ne commence pas par `avatars/`) ;
- ⚠️ **CORRECTION post-implémentation (2026-07-02)** : le raisonnement initial
  « delete par clé dans le bucket de l'env courant = no-op cross-env » supposait
  des buckets séparés — **FAUX : il n'existe aujourd'hui qu'UN bucket S3
  partagé prod/dev**. Risque résiduel accepté : si la base dev (seedée depuis
  prod, mêmes user ids) référence la même clé qu'une row prod, un remplacement
  d'avatar en dev peut supprimer un objet encore référencé en prod → avatar 404
  → fallback initiales (dégradé gracieux, ré-uploadable). Mitigation durable :
  **séparer les buckets dev/prod** (voir §F) — aucun changement de code requis,
  tout est env-driven ;
- gardes inchangées : rejet de `..`, bornage au préfixe `avatars/`, suppression
  toujours best-effort (`tryDeleteFromStorage`) après l'écriture DB ;
- **durcissement anti-IDOR (ajout post-revue)** : la suppression n'a lieu que si
  le chemin extrait commence par `avatars/{userId}/` (l'utilisateur COURANT) —
  une valeur `user.image` forgée via l'endpoint Better Auth `/update-user` ne
  peut plus faire supprimer l'avatar d'un tiers (IDOR pré-existant, fermé au
  passage). Coût : un legacy `avatars/<autre-id>/…` n'est pas purgé par ce flux
  — le script d'audit (§D) le rattrape.

Résultat : remplacer un avatar legacy (clé brute ou host croisé) supprime enfin
l'ancien objet — le stock d'orphelins avatars se résorbe au fil de l'eau.

## C. Suppression hybride des questions

`deleteQuestion` (`features/questions/actions.ts`) remanié — **pas de verrou
applicatif ni de SELECT préalable faillible : la contrainte FK arbitre,
atomiquement, au moment du DELETE** :

1. Transaction : lire les `storagePath` de `question_images`, puis tenter le
   hard `DELETE FROM questions WHERE id = … AND deleted_at IS NULL`.
2. **Succès** → la question n'était référencée par aucun
   examen/réponse/entraînement (garanti par les trois `onDelete: restrict`).
   La cascade DB emporte `question_images` + `question_explanations`. Après
   commit : `tryDeleteFromStorage` de chaque image (best-effort, hors
   transaction). Mode = `"hard"`.
3. **Violation FK `23001`** (restrict_violation — vérifié à l'implémentation :
   `ON DELETE RESTRICT` lève `23001`, PAS `23503` qui est réservé aux
   inserts/NO ACTION ; le code accepte les deux) → fallback soft delete
   (`SET deleted_at = now()`),
   lignes `question_images` et objets S3 **conservés** (encore servis en
   passation/correction). Mode = `"soft"`.
4. Retour `{ success: true, mode: "hard" | "soft" }` → toast admin différencié :
   « Question supprimée définitivement » vs « Question archivée : référencée par
   des examens ou entraînements ; ses médias sont conservés ».

Note d'implémentation : Drizzle enveloppe l'erreur pg — détecter `23001`/`23503`
via le `code` de la `cause` (DrizzleQueryError → cause = DatabaseError pg ;
vérifié par test d'intégration sur branche Neon).

Race « check → insertion concurrente d'examen » : inexistante par construction —
il n'y a pas de check applicatif ; si une référence apparaît avant le DELETE,
Postgres lève 23001 et on retombe sur le soft delete.

## D. Script d'audit / GC des orphelins

`scripts/audit-medias.ts` (exécution `bun run scripts/audit-medias.ts`, env de
l'environnement ciblé) — **dry-run par défaut**, purge uniquement avec un flag
explicite (`--purge`) :

- **Inventaire DB** : `user.image` classés par forme (URL Google / URL CDN /
  clé brute / `data:` / null) ; `question_images.storagePath` (+ statut
  soft-deleted de la question).
- **Diff S3** : `ListObjectsV2` sur `avatars/` et `questions/` →
  **orphelins** (objet sans référence DB, avec âge) et **liens cassés**
  (référence DB sans objet — le cas déjà rencontré en dev) ; `tmp/` compté et
  signalé mais laissé à la règle Lifecycle.
- **GC** : questions soft-deleted devenues totalement déréférencées
  (`NOT EXISTS` sur `exam_questions`, `exam_answers`,
  `training_session_items`) → hard delete + purge S3, même mécanique que §C
  (le DELETE reste protégé par les FK restrict).
- **Garde-fous** : jamais de purge d'objets de moins de 24 h (upload
  possiblement en cours de confirmation), lots bornés, récapitulatif avant
  action.
- La logique de classification/diff vit en **fonctions pures** exportées
  (testables en unit), le script n'étant que l'orchestration I/O.
- Le script est réellement **standalone** (précision post-revue) : il construit
  son propre pool `pg`/drizzle depuis `DATABASE_URL` et son propre client S3 —
  il n'importe ni `lib/aws.ts`/`lib/storage.ts` (`server-only`) ni `@/db` (dont
  l'import de `lib/env/server` exigerait tout le schéma d'env :
  `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`…). Env requis exact :
  `DATABASE_URL` + `S3_REGION` + `S3_BUCKET` + `AWS_ACCESS_KEY_ID` +
  `AWS_SECRET_ACCESS_KEY`. Il affiche sa cible (bucket + host DB) au démarrage
  pour parer une fuite silencieuse d'env dev via dotenv.
- Le script affiche, si la permission le permet
  (`GetBucketLifecycleConfiguration`), l'existence réelle de la **règle
  Lifecycle sur `tmp/`** — aujourd'hui documentée seulement en commentaire, à
  vérifier sur les DEUX buckets (sinon check manuel console à faire une fois).

**Prérequis IAM** : l'audit exige `s3:ListBucket`. La clé IAM dev est
write-only → étendre la policy dev ; pour la prod, créer des credentials de
liste **read-only** dédiés (pas de réutilisation de la clé d'écriture prod).

## E bis. Bucket partagé prod/dev — garde-fous purge (ajout 2026-07-02)

Tant que le bucket est partagé : le diff « orphelins » du script n'est valide
que contre la base **prod** (la base dev ne référence qu'un sous-ensemble des
objets → des médias 100 % légitimes en prod paraîtraient orphelins vus de dev).
**`--purge` est donc INTERDIT avec `DATABASE_URL` dev** tant que la séparation
n'est pas faite ; le script affiche un avertissement en mode purge. Le dry-run
reste sans risque. Cible recommandée : créer un bucket dev dédié + basculer
l'origin de la distribution CloudFront dev dessus (zéro changement de code).

## E. Audit prod (lecture seule stricte)

- **DB** : créer une **branche Neon éphémère** depuis la prod (copie
  instantanée ; la prod primaire n'est jamais contactée) et y exécuter les
  SELECT d'inventaire du script. Supprimer la branche ensuite.
- **S3** : script en dry-run avec les creds de liste read-only prod.
- Livrable : comptes de `user.image` par catégorie, orphelins par préfixe,
  liens cassés. Toute purge prod = décision séparée, exécutée ensuite via le
  même script (`--purge`).

## Approches écartées

- **Fix dans `ui/avatar.tsx` (statu quo)** : couvre tout site futur, mais diff
  permanent avec shadcn upstream + couplage `ui/` → `lib/cdn` + initiales
  toujours dupliquées.
- **`next/image` dans `UserAvatar`** : perte du fallback automatique Radix,
  `data:` non supporté sans `unoptimized`, quota de transformations consommé
  pour des vignettes 32 px déjà croppées à l'upload.
- **Backfill `user.image`** (brute→URL ou URL→clé) : migration à écrire et à
  exécuter en prod pour un gain nul dès lors que le rendu et le delete au
  remplacement acceptent toutes les formes.
- **Nettoyage S3 au soft delete** : casserait des images encore servies
  (passation/correction) — exclu par le fait vérifié « exams/dal ne filtre pas
  `deletedAt` ».
- **Soft delete uniforme (pas d'hybride)** : simple mais laisse les questions
  jamais utilisées (brouillons, doublons) s'accumuler en base et en S3 sans
  jamais pouvoir les purger proprement.
- **Cron de purge récurrent** : mécanique + surface d'erreur en plus pour des
  volumes faibles ; le script ponctuel suffit et sert aussi d'outil d'audit
  prod.

## Impact tests

- **Unit (vitest, happy-dom)** : `UserAvatar` — les formes d'entrée +
  fallback initiales (via `getInitials` partagé, déjà couvert par
  `tests/lib/utils.test.ts` — pas de re-test) ; `resolveAvatarUrl` et
  `avatarStoragePathFromImageValue` en **complétant le fichier EXISTANT**
  `tests/lib/cdn.test.ts` (matrice : clé brute, URL CDN courante, URL CDN autre
  host, URL Google, `data:`, `..`, null) ; retrait du
  `describe("avatarStoragePathFromUrl")` de `tests/lib/storage.test.ts`
  (fonction supprimée) ; fonctions de classification/diff du script d'audit.
- **Intégration (`tests/integration/`, branche Neon éphémère)** :
  `deleteQuestion` hybride — hard path (question isolée → lignes disparues,
  chemins S3 collectés), soft path (question référencée → `deletedAt` posé,
  `question_images` intactes), détection `23001` (forme réelle de l'erreur
  Drizzle/pg). Repointer le test « soft delete » existant de
  `tests/integration/questions-actions.test.ts` (sa question jamais référencée
  part désormais en hard). Respecter l'ordre de cleanup FK (enfants avant
  parents).
- **Composants migrés** : ajuster les tests existants qui montent les 11 sites.
- **E2E** : aucun nouveau parcours requis ; le toast différencié peut s'ajouter
  en assertion d'un spec admin existant (optionnel).

## Séquencement suggéré (pour le plan)

1. A + B (composant + fix remplacement) — indépendants du reste, faible risque.
2. C (suppression hybride) + tests d'intégration.
3. D (script d'audit) + extension IAM dev ; première exécution en dev
   (assainissement historique + vérif Lifecycle `tmp/`).
4. E (audit prod : branche Neon + dry-run) → rapport → purge prod éventuelle.
