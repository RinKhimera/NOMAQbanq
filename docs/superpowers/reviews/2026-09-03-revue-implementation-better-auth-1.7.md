# Revue adversariale — montée better-auth 1.7.2 + migration `account.issuer`

**Date** : 2026-09-03
**Périmètre** : arbre de travail de la branche `feat/better-auth-1.7` (base `main` @ `307ed75`,
aucun commit propre à la branche). `git diff HEAD` sur 10 fichiers + 3 fichiers non suivis
(`drizzle/0016_account_issuer.sql`, `drizzle/meta/0016_snapshot.json`,
`tests/db/account-issuer-migration.test.ts`). Issue de référence : #160.
**Méthode** : lecture seule, posture hostile. Chaque constat est prouvé par une lecture de code
citée `fichier:ligne`, et chaque bug suspecté a fait l'objet d'une tentative de réfutation avant
d'être retenu (voir § 4). La source de vérité comportementale est **better-auth 1.7.2 telle
qu'installée dans `node_modules`** — jamais le guide de montée ni la branche amont.

**Gates**

| Commande | Code de sortie | Détail |
| --- | --- | --- |
| `bun run check` | **0** | prettier + `tsc --noEmit` + eslint `--max-warnings 0` |
| `bun run test` | **0** | 122 fichiers, 1397 tests, 35,9 s |

`bun run test:integration` **n'a pas été lancé** (créerait une branche Neon) ; aucun constat ne
l'exigeait. La branche Neon de production n'a jamais été interrogée : les chiffres de volumétrie
(64 lignes `account`, 34 google / 30 credential) proviennent de l'issue #160 et ne sont **pas**
vérifiés ici — c'est précisément l'objet du constat 3.

---

## 1. Table des constats

| # | Sév | fichier:ligne | Problème | Régression vs 1.6.25 ? |
| --- | --- | --- | --- | --- |
| 1 | 🟠 | `drizzle/0016_account_issuer.sql:12` | `SET NOT NULL` rend le déploiement **non réversible** : un Instant Rollback Vercel re-sert le code 1.6.25 contre une base migrée → tout `INSERT` dans `account` (inscription, liaison Google) viole la contrainte. La connexion continue de marcher → panne partielle et silencieuse. | NON (risque neuf) |
| 2 | 🟠 | `tests/db/account-issuer-migration.test.ts:7-11` + `package.json:74` | Le test affirme casser en premier si une montée bascule Google sur `local:oauth:google` via `identityStrategy`. **Faux** : il assied son attente sur la constante `google().accountIssuer`, qu'une telle option laisserait intacte. Avec `^1.7.2` et aucun `ignore` Dependabot, une 1.8 peut passer le CI au vert et dédoubler chaque compte Google en prod. | NON |
| 3 | 🟠 | `drizzle/0016_account_issuer.sql:10` | La migration remplit les lignes `credential` sans vérifier l'invariant `account_id = user_id` dont dépend **toute** la connexion par mot de passe en 1.7. Une ligne dérogeante est verrouillée en silence (« email ou mot de passe invalide »). La migration applique déjà le « échouer plutôt que deviner » au `provider_id` inattendu, pas à celui-ci. | NON |
| 4 | 🟡 | `.claude/rules/data-layer.md:218-221` vs `features/users/dal.ts:104` | Le fichier de règles énumère exactement ce que `getLoginMethods` lit de `account` (`providerId`, `createdAt`). Le diff y ajoute `account.id` et l'expédie à un composant client, sans mettre le contrat écrit à jour — alors qu'`AGENTS.md` l'exige. | NON |
| 5 | ℹ️ | `features/users/dal.ts:90` + `profile-login-methods.tsx:49-50` | Le type autorise un état impossible (`linked: true` + `accountId: null`) ; le composant s'en protège par un `return` muet — un clic sans effet ni retour utilisateur. | NON |
| 6 | ℹ️ | `lib/auth.ts:23` | `rateLimit.customRules["/forget-password"]` ne correspond à **aucun** endpoint de la 1.7.2. Règle morte (le vrai chemin, `/request-password-reset`, est bien couvert ligne 22). | Indéterminé |
| 7 | ℹ️ | `features/users/dal.ts:102-108` | Lecture de `account` sans `.limit()`, contre la règle « reads bornés » d'`AGENTS.md`. Préexistant, borné en pratique (≤ 2 lignes), mais le diff touche cette requête. | NON |

Aucun constat 🔴. L'implémentation est **conforme** à la 1.7.2 installée sur les trois points qui
comptent (valeurs d'émetteur, index unique, forme de `unlinkAccount`) — voir § 4 et § 5.

---

## 2. Détail par constat

### 1 — 🟠 Le `SET NOT NULL` rend le déploiement non réversible

**Code**
- `drizzle/0016_account_issuer.sql:9-12` — `ADD COLUMN "issuer" text` puis `ALTER COLUMN "issuer" SET NOT NULL`.
- `scripts/migrate-deploy.ts:14-30` — les migrations ne sont appliquées **qu'au build** et
  seulement si `VERCEL_ENV === "production"`.
- `vercel.json:3` — `buildCommand: "bun run build:vercel"`, soit `migrate-deploy` puis `next build`.
- `node_modules/better-auth/dist/db/internal-adapter.mjs:592-598` (`linkAccount`) et
  `node_modules/better-auth/dist/api/routes/sign-up.mjs:246` — en 1.7 l'`issuer` est fourni à chaque
  création de ligne ; le code 1.6.25 ne le fournit évidemment pas.

**Pourquoi c'est un vrai bug.** Le déclencheur est concret et fréquent : un Instant Rollback Vercel
**re-sert un build existant**, il ne rejoue aucun build, donc aucune migration inverse. Après un
retour au déploiement précédent, la base porte `issuer NOT NULL` et le code servi est 1.6.25 :
chaque `INSERT INTO account` part sans `issuer` → `null value in column "issuer" violates not-null
constraint`. Concrètement : **plus aucune inscription, plus aucune liaison Google**. La connexion,
qui ne fait que lire, continue de fonctionner — c'est ce qui rend la panne difficile à repérer
(le trafic authentifié reste vert, seuls les nouveaux comptes échouent).

Le patron « trois temps » de `drizzle/0013_*.sql` cité en modèle ne portait pas ce risque : la table
`products` n'est pas écrite par better-auth au fil de l'eau. `account` l'est à chaque inscription.

**Régression vs 1.6.25** : NON — c'est un risque opératoire introduit par ce changement.

**Comment je l'ai prouvé.** Lecture de `scripts/migrate-deploy.ts` (gate `VERCEL_ENV`, migrations
au build uniquement) et de `vercel.json`. Lecture des points d'écriture d'`issuer` dans la
bibliothèque installée : `grep -rn "issuer:" node_modules/better-auth/dist/db/internal-adapter.mjs
node_modules/better-auth/dist/api/routes/sign-up.mjs`. Aucun `DEFAULT` dans `0016`
(`cat drizzle/0016_account_issuer.sql`).

**Correctif suggéré.** Ne pas changer le SQL — le rendre explicite. Ajouter au fichier de migration
(ou au runbook de déploiement) la ligne : *« 0016 est un aller simple : un rollback du déploiement
exige `ALTER TABLE account ALTER COLUMN issuer DROP NOT NULL;` avant de revenir au code
précédent. »* Sinon, le seul correctif structurel est un expand/contract en deux déploiements
(colonne nullable + code 1.7 d'abord, `SET NOT NULL` dans une migration ultérieure).

---

### 2 — 🟠 Le test de migration ne couvre pas la régression que son commentaire annonce

**Code**
- `tests/db/account-issuer-migration.test.ts:7-11` — le commentaire : *« Si une montée de version
  change l'un des deux émetteurs (ex. `identityStrategy` qui basculerait Google sur
  `local:oauth:google`) […] ce test casse d'abord. »*
- `tests/db/account-issuer-migration.test.ts:26-32` — l'assertion effective :
  `google({...}).accountIssuer`.
- `node_modules/@better-auth/core/dist/social-providers/google.mjs:57` —
  `accountIssuer: "https://accounts.google.com"`, **constante en dur**, indépendante des options.
- `node_modules/better-auth/dist/oauth2/account-key.mjs:24-25` — c'est **ici** que l'émetteur
  effectif est résolu : `provider.accountIssuer` sans le moindre aiguillage par stratégie.
- `package.json:74` — `"better-auth": "^1.7.2"`.
- `.github/dependabot.yml:56-61` — le groupe `runtime` capture `"*"` en `minor`/`patch` ;
  `.github/dependabot.yml:68-80` — le bloc `ignore` existe et ne contient pas `better-auth`.

**Pourquoi c'est un vrai bug.** L'issue #160 dit que la 1.7 « offre » `account.identityStrategy` ;
l'option n'existe pas en 1.7.2 (`grep -rn "identityStrategy" node_modules/better-auth/
node_modules/@better-auth/` → 0 fichier). Elle arrivera donc dans une version ultérieure. Le jour
où elle arrive, elle s'insérera dans `resolveOAuthAccountKey` — la fonction qui *résout* l'émetteur —
et non dans la constante du fournisseur, qui restera `https://accounts.google.com`. Le test lit la
constante : **il restera vert**. Le CI laissera donc passer une 1.8 que le groupe `runtime`
proposera automatiquement, et à la première reconnexion Google `findAccountOwnerByKey({issuer:
"local:oauth:google", …})` ne trouvera plus la ligne migrée
(`node_modules/better-auth/dist/oauth2/link-account.mjs:21-24`), tombera sur le rattachement par
courriel, et **créera une seconde ligne `google`** — l'index unique ne s'y oppose pas, l'`issuer`
diffère. C'est exactement le scénario que le commentaire prétend intercepter.

**Régression vs 1.6.25** : NON — c'est un trou de couverture prospectif.

**Comment je l'ai prouvé.** `grep -rn "identityStrategy" node_modules/better-auth/
node_modules/@better-auth/` → aucun résultat. Puis lecture de `account-key.mjs:24-25` : la valeur
lue est `provider.accountIssuer`, et `google.mjs:57` la fige. Enfin `sed -n '56,80p'
.github/dependabot.yml` confirme que `better-auth` n'est pas dans `ignore` alors que l'issue #160
le demandait explicitement (§ « Périmètre Dependabot »).

**Correctif suggéré.** Deux gestes, tous deux triviaux :

1. Poser le garde-fou que l'issue prescrivait, dans le bloc `ignore` déjà existant :

   ```yaml
   # Retirer quand `account.identityStrategy` sera arbitré (cf. #160) : une
   # 1.x peut changer la résolution de l'émetteur sans changer la constante
   # du fournisseur, donc sans casser tests/db/account-issuer-migration.test.ts.
   - dependency-name: "better-auth"
     update-types: ["version-update:semver-minor", "version-update:semver-major"]
   ```

2. Corriger le commentaire du test pour qu'il n'annonce pas une garantie qu'il n'offre pas, et
   ajouter le test jumeau décrit en § 5 (question 7), qui teste la **résolution** et non la constante.

---

### 3 — 🟠 La migration ne vérifie pas l'invariant `credential.account_id = user_id`

**Code**
- `drizzle/0016_account_issuer.sql:10` — `UPDATE "account" SET "issuer" = 'local:credential'
  WHERE "provider_id" = 'credential';` — aucune condition sur `account_id`.
- `node_modules/better-auth/dist/api/routes/sign-in.mjs:320` — la ligne de connexion est retenue
  seulement si `providerId === "credential" && issuer === "local:credential" &&
  accountId === userRecord.user.id`.
- `node_modules/better-auth/dist/db/internal-adapter.mjs:625-643` (`updatePassword`) et
  `:653-676` (`findCredentialAccount`) — même prédicat à quatre branches.
- `drizzle/0016_account_issuer.sql:5-7` — le commentaire de la migration revendique le principe
  « tout autre `provider_id` est inattendu et fait échouer la migration […] plutôt que de recevoir
  une valeur devinée ».

**Pourquoi c'est un vrai bug.** L'invariant `account_id = user_id` est aussi porteur que le nom de
l'émetteur, et il n'est vérifié **nulle part dans le dépôt** : la seule preuve est une requête
manuelle consignée dans l'issue #160 le 2026-09-03. Si une ligne y déroge — en production, ou sur
n'importe quelle branche Neon de dev/preview qui rejouera cette migration plus tard —, la migration
la remplit joyeusement et son propriétaire devient inconnectable par mot de passe, avec le message
générique « email ou mot de passe invalide » (`sign-in.mjs:322-326`), indiscernable d'une faute de
frappe. La demande de réinitialisation, elle, recrée une seconde ligne credential
(`password.mjs:164-171`, branche `if (!findCredentialAccount(...))`) : l'utilisateur s'en sort, mais
la base porte deux lignes credential et personne n'a jamais su pourquoi.

Le coût de la vérification est nul, et la migration a déjà choisi ce style de garde-fou pour le
`provider_id`. L'asymétrie est le vrai constat.

**Régression vs 1.6.25** : NON.

**Comment je l'ai prouvé.** Lecture du prédicat de connexion :
`sed -n '300,375p' node_modules/better-auth/dist/api/routes/sign-in.mjs` (ligne 320). Puis
`sed -n '615,700p' node_modules/better-auth/dist/db/internal-adapter.mjs` pour `updatePassword` /
`findCredentialAccount`. Puis `cat drizzle/0016_account_issuer.sql` : aucune clause sur `account_id`,
aucun `DO $$ … RAISE EXCEPTION`.

**Correctif suggéré.** Une instruction de plus dans `0016`, avant le `SET NOT NULL` — elle
s'exécute dans la même transaction que le reste (cf. faux positif FP-3), donc un échec annule tout
et fait échouer le build proprement :

```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "account" WHERE "provider_id" = 'credential' AND "account_id" <> "user_id") THEN
    RAISE EXCEPTION 'account.credential : account_id <> user_id — la 1.7 ne retrouverait pas ces lignes à la connexion';
  END IF;
END $$;--> statement-breakpoint
```

---

### 4 — 🟡 Le contrat PII écrit ne décrit plus ce qui traverse la frontière

**Code**
- `.claude/rules/data-layer.md:218-221` : *« `getLoginMethods` / `getUserSessions`
  (`features/users/dal.ts`) lisent `account` (`providerId`, `createdAt`) […] »* — énumération
  fermée, pas d'`id`.
- `features/users/dal.ts:104` — `id: account.id` ajouté au `select`.
- `features/users/dal.ts:123` — `accountId: google?.id ?? null` renvoyé dans `LoginMethods`.
- `app/(dashboard)/tableau-de-bord/profil/_components/profile-login-methods.tsx:1` — `"use client"` :
  la valeur part dans la charge RSC.
- `AGENTS.md`, § *Instruction Routing* : « Ajouter les nouveaux patterns au fichier rules
  correspondant, pas ici. »

**Pourquoi c'est un vrai bug.** Ce n'est pas une fuite : `account.id` n'est pas un secret et l'accès
reste self-scoped (constat réfuté FP-4). C'est le **contrat de revue** qui devient faux. Ce fichier
est la liste de référence contre laquelle le prochain relecteur — humain ou agent — juge un `select`
sur `account`. Laissé tel quel, il produit soit une fausse alerte sur `account.id`, soit, pire,
l'habitude de considérer l'énumération comme indicative et de laisser passer la colonne suivante.
L'auteur a d'ailleurs mis à jour le commentaire local du DAL (`features/users/dal.ts:94`) : c'est le
fichier de règles, seul document partagé, qui a été oublié.

**Régression vs 1.6.25** : NON.

**Comment je l'ai prouvé.** `sed -n '205,245p' .claude/rules/data-layer.md` (énumération
ligne 218-221), confronté à `git diff HEAD -- features/users/dal.ts` (ajout de `id: account.id`
ligne 104) et à la directive d'`AGENTS.md`.

**Correctif suggéré.** Une ligne dans `.claude/rules/data-layer.md` : remplacer
`account` (`providerId`, `createdAt`) par `account` (`id`, `providerId`, `createdAt` — l'`id` est la
poignée que `unlinkAccount` exige depuis better-auth 1.7).

---

### 5 — ℹ️ État impossible autorisé par le type, compensé par un retour muet

**Code**
- `features/users/dal.ts:90` — `google: { linked: boolean; linkedAt: Date | null; accountId: string | null }`.
- `features/users/dal.ts:120-124` — les trois champs dérivent de la **même** ligne (`google`), donc
  `linked === true` implique toujours `accountId !== null`.
- `app/(dashboard)/tableau-de-bord/profil/_components/profile-login-methods.tsx:49-50` —
  `const accountId = methods.google.accountId; if (!accountId) return`.

**Pourquoi c'est un vrai bug (mineur).** La combinaison impossible n'existe que parce que le type la
permet ; le composant doit alors s'en défendre, et le fait par un `return` silencieux. Le bouton
« Délier » est rendu dès que `linked` est vrai (ligne 160) : si les deux champs divergeaient un jour
— une reconstruction manuelle de l'objet, un `mapper` intermédiaire —, le clic ne produirait
strictement rien, ni requête, ni toast, ni spinner. C'est le mode de défaillance le plus coûteux à
diagnostiquer depuis un rapport utilisateur.

**Régression vs 1.6.25** : NON.

**Comment je l'ai prouvé.** Lecture des trois emplacements ; la dérivation commune est visible
en `dal.ts:117` (`const google = rows.find(...)`) puis `:120-124`.

**Correctif suggéré.** Union discriminée, qui supprime la branche morte et le doute :
`google: { linked: true; linkedAt: Date; accountId: string } | { linked: false }`.

---

### 6 — ℹ️ `customRules["/forget-password"]` ne vise plus aucun endpoint

**Code**
- `lib/auth.ts:22-23` — deux règles : `/request-password-reset` et `/forget-password`.
- `node_modules/better-auth/dist/api/routes/password.mjs` — seul `/request-password-reset` y est
  déclaré ; aucun `createAuthEndpoint("/forget-password")` n'existe dans la 1.7.2.
- Les seules occurrences de `/forget-password` sont le plugin `email-otp`
  (`plugins/email-otp/routes.mjs:515`, endpoint `/forget-password/email-otp` — plugin non activé)
  et le filtre par défaut du limiteur (`api/rate-limiter/index.mjs:311`).
- `app/(auth)/mot-de-passe-oublie/page.tsx:34` — l'app appelle `authClient.requestPasswordReset`.

**Pourquoi c'est un vrai bug (cosmétique).** Aucun impact : le chemin réellement utilisé est couvert
par la règle de la ligne 22, et le limiteur applique de toute façon sa fenêtre par défaut. Mais la
ligne 23 fait croire à une protection sur un endpoint inexistant, et une montée de version est
justement le moment où l'on relit ce genre de liste — comme le commentaire de `disabledPaths`
(`lib/auth.ts:114-115`) le prescrit d'ailleurs pour les chemins admin.

**Régression vs 1.6.25** : indéterminé — je n'ai pas la 1.6.25 sous la main et je me refuse à
l'installer (`bun install` hors périmètre). La règle est préexistante et non touchée par le diff.

**Comment je l'ai prouvé.** `grep -rn "forget-password" node_modules/better-auth/dist/ | grep -v "\.d\.mts"`
puis `grep -rn "requestPasswordReset" --include=*.tsx app/`.

**Correctif suggéré.** Supprimer la ligne 23, ou la commenter comme couverture historique.

---

### 7 — ℹ️ Lecture non bornée de `account`

**Code** : `features/users/dal.ts:102-108` — `select(...).from(account).where(eq(account.userId, uid))`,
sans `.limit()`, là où la lecture de `user` juste en dessous (`:110-114`) porte bien `.limit(1)`.
`AGENTS.md`, § *Regles Critiques* : « **IMPORTANT - Reads bornés** : Toujours limiter ».

**Pourquoi c'est un vrai bug (marginal).** Borné en pratique par la réalité métier (deux
fournisseurs), et désormais par l'index unique. La règle projet est néanmoins absolue et le diff
touche cette requête précise.

**Régression vs 1.6.25** : NON (préexistant).

**Comment je l'ai prouvé.** Lecture de `features/users/dal.ts:102-114` et de la règle d'`AGENTS.md`.

**Correctif suggéré.** `.limit(10)` — sans effet fonctionnel, aligne la requête sur la règle et sur
sa voisine immédiate.

---

## 3. Ce qui est solide

Trois points méritent d'être dits, parce qu'ils étaient les plus faciles à rater et qu'ils sont justes :

1. **La valeur de remplissage Google est la bonne** — et l'issue #160 a tort (§ 5, question 1).
2. **L'index unique `(issuer, account_id)` est exactement ce que la bibliothèque déclare
   elle-même** : `node_modules/@better-auth/core/dist/db/get-tables.mjs:200-203` —
   `indexes: mergeTableIndexes([{ fields: ["issuer", "accountId"], unique: true }], …)`. Ce n'est
   pas un durcissement maison, c'est le contrat de la 1.7.
3. **La migration est atomique** et échoue proprement sur toute donnée inattendue (FP-3, § 5 question 5).

---

## 4. Faux positifs écartés

**FP-1 — « `getJoinRelationKey` pluralise `user` en `users` → `findAccountOwnerByKey` casse, donc
toute connexion Google est morte. »**
Suspecté à la lecture de `node_modules/@better-auth/drizzle-adapter/dist/index.mjs:296-305` :
`isUnique = joinAttr.relation === "one-to-one"` alors que l'adaptateur interne passe littéralement
`join: { user: true }` (`internal-adapter.mjs:553`) — `true.relation` vaut `undefined`, donc
`isUnique` serait faux et la clé deviendrait `"users"`, introuvable dans `accountRelations`.
**Écarté deux fois.** D'abord parce que la fabrique d'adaptateurs normalise le `join` **avant** de
le transmettre : `node_modules/@better-auth/core/dist/db/adapter/factory.mjs:277-331` transforme
`{user: true}` en `{user: {on, limit, relation: "one-to-one"}}` — `to === "id"` ⇒ `isUnique = true`
(ligne 320). La branche unique appelle alors `getOneToOneRelationKey`
(`query-builders-CBLMSM7v.mjs:17-26`), qui trouve bien la clé `user` déclarée en
`db/schema/auth.ts:144`. Ensuite parce que la question est **sans objet ici** :
`advanced.database.joins` n'est pas activé dans `lib/auth.ts`, donc `factory.mjs:551` pose
`passJoinToAdapter = false` et le chemin « relations Drizzle » n'est jamais emprunté — better-auth
retombe sur `handleFallbackJoin` (requêtes séparées).

**FP-2 — « `join: { account: true }` cherche une relation `accounts`, non déclarée. »**
Même mécanique, sens inverse : `findUserByEmail` avec `includeAccounts` (`internal-adapter.mjs:573`)
produit `relation: "one-to-many"` (la FK n'est pas `id`, `factory.mjs:320`), et l'adaptateur
demande `` `${joinModel}s` `` = `accounts` (`index.mjs:304`, `usePlural: false`). `db/schema/auth.ts:137`
déclare exactement `accounts: many(account)`. Concordance. Fragile par nature (un renommage de la
relation casserait en silence) mais **correct**, et de toute façon inerte tant que `joins` est
désactivé.

**FP-3 — « Un échec au milieu de la migration laisse la prod à moitié migrée. »**
Écarté. `bun run db:migrate` → `drizzle-kit migrate` → `migrateFn` du pilote `pg`
(`node_modules/drizzle-kit/bin.cjs:78902-78904`) qui délègue au migrateur de drizzle-orm, lequel
enveloppe **toutes** les migrations en attente dans un unique `session.transaction`
(`node_modules/drizzle-orm/pg-core/dialect.js:60-71`), journalisation comprise. Un `SET NOT NULL`
qui échoue sur une ligne restée `NULL` annule tout, la migration n'est pas journalisée,
`migrate-deploy.ts:27-30` propage le code non nul et le build Vercel échoue → la prod reste sur
l'ancien couple code+schéma. `CREATE INDEX` non concurrent est transactionnel en Postgres.

**FP-4 — « `getLoginMethods` expose `account.id` au client, donc IDOR sur `unlinkAccount`. »**
Écarté. `node_modules/better-auth/dist/api/routes/account.mjs:279-283` : la route liste d'abord
`findAccounts(ctx.context.session.user.id)` puis cherche l'`id` **dans cette liste**. Un `accountId`
appartenant à autrui n'y figure pas → `ACCOUNT_NOT_FOUND`. S'y ajoute `freshSessionMiddleware`
(ligne 266) et le garde « dernier compte » (ligne 280). Même conclusion pour les routes qui
retourneraient un jeton OAuth : `resolveUserId` (`:302-311`) impose une session à tout appelant HTTP
et la session l'emporte sur un `userId` fourni, puis `resolveUserAccount` (`:329-335`) refiltre par
`findAccounts(resolvedUserId)`.

**FP-5 — « L'index unique casse la réinscription Google après anonymisation. »**
Écarté. `features/users/cron.ts:40` : `await tx.delete(account).where(eq(account.userId, id))` — le
cron purge **toutes** les lignes `account` dans la transaction d'anonymisation. Aucun résidu
`(https://accounts.google.com, sub)` ne survit, donc aucune collision à la réinscription. Pour la
suppression douce dans la fenêtre de grâce, les lignes `account` sont conservées : la reconnexion
Google les retrouve par `findAccountOwnerByKey` et n'insère rien
(`link-account.mjs:21-24` puis `:40-52`) — c'est le comportement voulu (`lib/auth.ts:42-45`).

**FP-6 — « La 1.7.2 ajoute des endpoints admin non fermés par `disabledPaths`. »**
Écarté, vérifié par différence d'ensembles et non à l'œil : les 15 `createAuthEndpoint`
de `node_modules/better-auth/dist/plugins/admin/*.mjs` et les 15 chaînes `/admin/*` de
`lib/auth.ts:116-132` coïncident exactement — `actual NOT disabled: []`,
`disabled but nonexistent: []`. Aucune dérive.

**FP-7 — « La cohérence journal/snapshot Drizzle est cassée. »**
Écarté. `drizzle/meta/0015_snapshot.json`.`id` === `drizzle/meta/0016_snapshot.json`.`prevId`
(`7123f30e-…`), et le snapshot 0016 porte bien `issuer` en `notNull: true` ainsi que les deux index,
dont `account_issuer_account_id_uidx` avec `isUnique: true` sur `["issuer", "account_id"]`. Un futur
`db:generate` repartira d'un état exact.

**FP-8 — « L'issue #160 prescrit `local:oauth:google` ; l'implémentation s'en écarte, donc elle a
tort. »** Écarté — c'est l'issue qui a tort. Voir § 5, question 1.

**Non tranché (donc absent de la table des constats)** —
`accountLinking.requireLocalEmailVerified` vaut `true` par défaut en 1.7.2
(`link-account.mjs:80`) : un utilisateur inscrit par courriel et **non vérifié** qui tenterait
« Se connecter avec Google » se verrait refuser le rattachement (« account not linked »), malgré
`trustedProviders: ["google"]`. Je ne peux pas établir si la 1.6.25 se comportait autrement sans
l'installer, ce que le périmètre interdit ; je m'abstiens donc d'annoncer une régression. En
pratique la population concernée est étroite (`requireEmailVerification: true` empêche déjà ces
comptes de se connecter par mot de passe). Le test manuel « liaison Google » déjà prévu à l'étape 8
de l'issue #160 couvre le cas — le faire **depuis un compte non vérifié** en plus du cas nominal.

---

## 5. Réponses aux questions ouvertes

### Question 1 — La valeur de remplissage Google

**L'auteur a raison, l'issue #160 a tort. Ne pas revenir à `local:oauth:google`.**

- `account.identityStrategy` **n'existe pas** en 1.7.2 :
  `grep -rn "identityStrategy" node_modules/better-auth/ node_modules/@better-auth/` ne renvoie
  aucun fichier. Le guide de montée décrit une version postérieure à celle publiée sur npm.
- L'émetteur effectivement écrit est résolu par
  `node_modules/better-auth/dist/oauth2/account-key.mjs:24-25` :
  `const issuer = accountIssuer === void 0 ? createOAuthAccountIssuer(provider.id) : …`.
  Google **déclare** le sien (`social-providers/google.mjs:57` :
  `accountIssuer: "https://accounts.google.com"`), donc la branche `createOAuthAccountIssuer`
  — celle qui produirait `local:oauth:google` — n'est jamais atteinte.
- **Conséquence d'un remplissage `local:oauth:google`** : à la première reconnexion,
  `findAccountOwnerByKey({issuer: "https://accounts.google.com", …})`
  (`internal-adapter.mjs:543-554`) ne trouve rien ; le flux retombe sur `findUserByEmail`
  (`link-account.mjs:62`), puis `dbUser.accounts.find(acc => acc.issuer === account.issuer && …)`
  (`:77`) échoue également — la comparaison porte sur l'`issuer`, pas sur le `providerId`. Google
  étant dans `trustedProviders` (`lib/auth.ts:35`), le rattachement implicite est autorisé et
  `linkAccount` **insère une seconde ligne** (`:104-114`). L'index unique ne l'empêche pas : la
  paire diffère par l'`issuer`. Le diagnostic de l'auteur est exact jusqu'au détail.

**Effets de bord de la valeur retenue** — j'en ai cherché trois, aucun n'est problématique :

- *`linkSocial` depuis le profil* : `handleOAuthUserInfo` emprunte le même
  `resolveOAuthAccountKey`, donc le même `https://accounts.google.com`. Un compte déjà lié est
  retrouvé et voit seulement ses jetons rafraîchis (`link-account.mjs:139-160`). Aucun doublon.
- *Compte migré sans ligne `account`* : cas inexistant ici — les 64 lignes couvrent les deux
  fournisseurs, et un utilisateur sans ligne `account` ne pourrait de toute façon pas se connecter
  avant la migration non plus.
- *Cohérence avec la bibliothèque* : `get-tables.mjs:200-203` montre que 1.7.2 attend elle-même
  l'unicité sur `(issuer, accountId)`. Le couple (valeur d'émetteur, index) retenu est celui que la
  bibliothèque produirait pour une base neuve.

**Réserve, et c'est le constat 2** : cette justesse est indexée sur la **1.7.2 exactement**. La
plage `^1.7.2` et l'absence d'`ignore` Dependabot laissent une 1.8 arriver seule, et le test de
migration ne la verra pas passer.

### Question 2 — Deux insertions légitimes de la même paire `(issuer, account_id)` ?

**Non, aucun chemin légitime n'en produit deux.** Les quatre pistes proposées, une par une :

| Piste | Verdict | Preuve |
| --- | --- | --- |
| Liaison Google concurrente | Aucune corruption ; l'index **améliore** le comportement | Deux callbacks simultanés voient `findAccountOwnerByKey` renvoyer `null` et tentent tous deux `linkAccount`. En 1.6.25, sans index, **les deux réussissaient** → deux lignes `google` identiques. En 1.7 le second `INSERT` viole l'index unique ; l'exception est capturée en `link-account.mjs:115-122` → `{error: "unable to link account"}` → redirection d'erreur. L'utilisateur voit un échec, réessaie, et la seconde tentative trouve la ligne créée par la première. |
| Réactivation après suppression douce | Aucun `INSERT` | Les lignes `account` ne sont pas touchées par la suppression douce ; `findAccountOwnerByKey` les retrouve et le flux part sur la branche « déjà liée » (`link-account.mjs:139`). Le hook `session.create.after` (`lib/auth.ts:57-68`) efface `deletedAt`. |
| Cron `anonymizeExpiredDeletedAccounts` | Aucun résidu possible | `features/users/cron.ts:40` supprime **toutes** les lignes `account` de l'utilisateur dans la même transaction que le scrub. |
| Réinscription après anonymisation avec le même compte Google | Fonctionne | Corollaire du précédent : plus aucune ligne ne porte la paire, l'inscription crée un utilisateur neuf (`link-account.mjs:200-232`). |

**Ce qui change réellement, et qu'il faut connaître** : deux utilisateurs distincts ne peuvent plus
lier le **même** compte Google. Le second reçoit un échec propre (`account_ownership_conflict`,
`link-account.mjs:40-43`, ou l'erreur de liaison générique) au lieu de la seconde ligne silencieuse
de la 1.6.25. C'est le durcissement voulu par l'amont, pas un défaut.

**Côté `credential`, l'index est inerte** : la paire est `(local:credential, user.id)` et `user.id`
est déjà une clé primaire. Une collision y est arithmétiquement impossible.

### Question 3 — IDOR sur `unlinkAccount` ?

**Non.** Voir FP-4 pour le détail. En bref : `account.mjs:279-283` ne cherche l'`accountId` que
**dans la liste des comptes de la session courante** ; un id étranger produit `ACCOUNT_NOT_FOUND`,
pas une suppression. La route est en outre derrière `freshSessionMiddleware` (session de moins de
24 h, `create-context.mjs:148`) et refuse de délier le dernier moyen de connexion — les deux cas
sont d'ailleurs traités à l'écran (`profile-login-methods.tsx:56-69`). Exposer `account.id` au
client ne crée donc aucun pouvoir nouveau : l'id n'est pas une capacité, c'est un sélecteur revérifié
côté serveur. Reste le constat 4, qui est documentaire et non sécuritaire.

### Question 4 — Les relations Drizzle satisfont-elles l'adaptateur 1.7 ?

**Oui — et la question est de surcroît sans objet dans la configuration actuelle.**

*Sans objet* : `advanced.database.joins` n'est pas activé dans `lib/auth.ts`. La fabrique pose donc
`passJoinToAdapter = false` (`factory.mjs:551` pour `findOne`, `:599` pour `findMany`) et
l'adaptateur Drizzle reçoit `join: undefined`. Le chemin `db.query.<modèle>` / `with:` n'est **jamais**
emprunté ; better-auth résout les jointures par requêtes séparées (`handleFallbackJoin`).

*Et si on l'activait* : la concordance est exacte, dans les deux sens.

| Appel | Relation attendue par l'adaptateur | Déclarée | Verdict |
| --- | --- | --- | --- |
| `findOne({model:"account", join:{user:true}})` (`internal-adapter.mjs:553`) | `relation: "one-to-one"` (`factory.mjs:320`, `to === "id"`) ⇒ `getOneToOneRelationKey` ⇒ **`user`** | `accountRelations.user` (`db/schema/auth.ts:144`) | ✅ |
| `findOne({model:"user", join:{account:true}})` (`internal-adapter.mjs:573`) | `relation: "one-to-many"` ⇒ `` `${joinModel}s` `` = **`accounts`** (`index.mjs:304`, `usePlural: false`) | `userRelations.accounts` (`db/schema/auth.ts:137`) | ✅ |
| `findOne({model:"session", join:{user:true}})` (`internal-adapter.mjs:350`) | **`user`** | `sessionRelations.user` (`db/schema/auth.ts:141`) | ✅ |

Le point de fragilité que la question pressent est réel mais porte sur la branche **one-to-many** :
`getJoinRelationKey` y déduit le nom par simple suffixe `s`, sans consulter les relations déclarées
(`index.mjs:296-305`). Renommer `userRelations.accounts` en autre chose casserait en silence.
`db.query.account` / `db.query.user` existent bien, `db/index.ts:32` construisant le client avec
`drizzle(pool, { schema })` et `db/schema` exportant les tables sous ces clés exactes.

### Question 5 — Un `provider_id` inattendu au déploiement

**Le build échoue proprement ; la prod n'est jamais à moitié migrée.**

Séquence : la ligne inconnue n'est visée par aucun des deux `UPDATE`
(`0016:10-11`), son `issuer` reste `NULL`, et `ALTER COLUMN "issuer" SET NOT NULL` (`:12`) échoue avec
`column "issuer" of relation "account" contains null values`. Comme tout est dans une transaction
unique (FP-3), le `ADD COLUMN` et les deux `UPDATE` sont annulés, la ligne de journal n'est pas
écrite, `drizzle-kit` sort non nul, `migrate-deploy.ts:27-30` propage, `bun run build:vercel`
échoue avant `next build`. Le déploiement n'est pas promu, la prod continue de servir l'ancien
couple code+schéma. C'est exactement l'intention documentée en `scripts/migrate-deploy.ts:6-7`, et
le comportement que le commentaire de `0016:5-7` revendique.

**Le cas peut-il se produire ?** Seuls `credential` et `google` sont atteignables :
`socialProviders` ne configure que Google (`lib/auth.ts:104-113`), et tous les autres points
d'écriture de la bibliothèque écrivent `credential` (`sign-up.mjs:246`, `password.mjs:167`,
`update-user.mjs:223`, `plugins/admin/routes.mjs:206` et `:845`). Les plugins qui introduiraient
d'autres valeurs (`siwe`, `phone-number`, `email-otp`) ne sont pas montés. Aucun `INSERT` applicatif
direct dans `account` n'existe hors des tests
(`grep -rn "insert(account" --include=*.ts . --exclude-dir=node_modules` → seulement
`tests/integration/users-account.test.ts:42` et `:246`), et aucune migration antérieure n'y insère
de ligne.

**Réserve à noter** : ce garde-fou vaut pour un `provider_id` inconnu, **pas** pour l'invariant
`credential.account_id = user_id` — c'est le constat 3.

### Question 6 — `disabledPaths` face à la 1.7.2

**Aucune dérive : 15 endpoints déclarés, 15 endpoints existants, ensembles identiques.** Vérifié par
différence d'ensembles plutôt qu'à l'œil (les deux directions renvoient `[]`) : aucun endpoint admin
de la 1.7.2 n'échappe à la liste, et aucune entrée de la liste ne vise un chemin disparu. La
consigne de `lib/auth.ts:114-115` (« Match EXACT : re-vérifier la liste à chaque montée de version »)
est donc honorée pour cette montée. Tous les endpoints du plugin sont déclarés dans le seul
`plugins/admin/routes.mjs` ; `index.mjs` n'en ajoute aucun.

### Question 7 — Le test de migration teste-t-il quelque chose ?

**Il teste quelque chose de réel, mais pas ce que son commentaire promet.**

*Ce qu'il attrape.* Une divergence entre les constantes figées dans le SQL et celles de la
bibliothèque installée — par exemple si `createLocalAccountIssuer` changeait de préfixe, ou si le
`accountIssuer` de Google était corrigé en amont. Ce n'est pas rien : il fait échouer le CI **avant**
qu'une montée n'atteigne la prod, et il documente la provenance des deux valeurs. Le fichier passe
bien dans `bun run test` (`vitest.config.ts:130`, `include: ["tests/**/*.test.{ts,tsx}"]` ; 122
fichiers sur disque = 122 exécutés).

*Ce qu'il laisse passer — il passerait avec une migration fausse dans au moins quatre cas.*

1. **La régression que le commentaire nomme** (constat 2) : une future `identityStrategy` change la
   *résolution* (`account-key.mjs:25`) sans toucher la *constante* (`google.mjs:57`) que le test lit.
2. **Suppression du `SET NOT NULL`** (`0016:12`) : aucune assertion ne le couvre. Le schéma Drizzle
   resterait `notNull`, `tsc` ne verrait rien, et better-auth insérerait des `issuer` NULL jusqu'à
   la première lecture bancale.
3. **Suppression ou altération de l'index unique** (`0016:13`) : non asserté, alors que
   `get-tables.mjs:200-203` en fait un élément du contrat 1.7.
4. **L'invariant `credential.account_id = user_id`** (constat 3) : hors de portée du test.

Il souffre en outre d'un défaut de cible : une migration appliquée est **immuable**. Une fois `0016`
jouée en prod, éditer le `.sql` pour faire reverdir le test ne changerait rien à la base — la
remédiation que le test suggère implicitement est la mauvaise.

**Le test jumeau qui manque** — conforme au principe « écrire par paires jumelles » : le premier
épingle une chaîne, le second doit épingler le **comportement**. Concrètement, un test qui traverse
`resolveOAuthAccountKey`, c'est-à-dire le code qui décide vraiment :

```ts
import { resolveOAuthAccountKey } from "better-auth/oauth2"
import { google } from "@better-auth/core/social-providers"

// Jumeau de « remplit les comptes Google avec l'émetteur déclaré » : celui-là épingle
// la CONSTANTE du fournisseur, celui-ci la RÉSOLUTION. Une montée qui introduirait
// `identityStrategy` changerait la seconde sans toucher la première — c'est le seul
// des deux qui verrait passer un basculement vers `local:oauth:google`.
it("résout pour Google l'émetteur que la migration 0016 a écrit en base", async () => {
  const provider = google({ clientId: "id", clientSecret: "secret" })
  const { issuer } = await resolveOAuthAccountKey(provider, {}, { sub: "123" })
  expect(issuer).toBe("https://accounts.google.com")
})
```

(Vérifier l'export exact de `resolveOAuthAccountKey` depuis l'entrée publique ; à défaut, l'importer
depuis `better-auth/dist/oauth2/account-key.mjs` avec un commentaire expliquant pourquoi le chemin
profond est assumé.)

**Deux tests jumeaux secondaires**, moins urgents mais quasi gratuits :

- Sur la migration elle-même : asserter la présence de `SET NOT NULL` et de l'index unique sur
  `("issuer","account_id")` — sinon deux tiers de `0016` ne sont couverts par rien.
- En intégration (`tests/integration/users-account.test.ts`) : insérer deux lignes portant la même
  paire `(issuer, account_id)` et attendre le rejet. L'index unique est aujourd'hui **testé nulle
  part**, alors qu'il est la seule partie de ce changement qui peut faire échouer un flux
  utilisateur en production.

---

## 6. Verdict

> **Peut-on merger et déployer cette migration en production sur les 64 comptes existants ?**
> **OUI** — aucun point bloquant. L'implémentation est correcte contre la 1.7.2 réellement
> installée, sur les trois axes qui décident du sort des comptes existants : la valeur d'émetteur
> Google (question 1, l'auteur a raison contre son propre ticket), l'index unique
> `(issuer, account_id)` — que la bibliothèque déclare elle-même —, et l'atomicité de la migration,
> qui garantit qu'un imprévu fait échouer le build au lieu de laisser la prod à moitié migrée.
> Les deux gates sont verts.
>
> Les trois constats 🟠 ne remettent pas en cause le déploiement lui-même : aucun ne casse un
> parcours au moment de la migration. Deux concernent l'**après** (l'impossibilité de revenir en
> arrière, et une porte laissée ouverte à la montée suivante), un concerne une hypothèse sur les
> données jamais vérifiée par le code. Tous se corrigent en quelques lignes et je les traiterais
> avant de déployer, pas après.

**Correctifs priorisés**

| Priorité | # | Correctif | Effort |
| --- | --- | --- | --- |
| **Avant déploiement** | 3 | Ajouter au `0016` le `DO $$ … RAISE EXCEPTION` sur `credential.account_id <> user_id` (§ 2.3). C'est le seul geste dont la fenêtre se referme : une fois la migration jouée, on ne peut plus l'ajouter. | 4 lignes de SQL |
| **Avant déploiement** | 1 | Consigner que `0016` est un aller simple, et la commande de dégagement (`ALTER COLUMN issuer DROP NOT NULL`) à passer avant tout rollback vers la 1.6.25. | 2 lignes de commentaire |
| **Avant déploiement** | 2 | `ignore` Dependabot sur `better-auth` (minor + major), comme l'issue #160 le prescrivait, et corriger le commentaire trompeur du test. | 5 lignes de YAML |
| **Avant merge** | 4 | Mettre `.claude/rules/data-layer.md:218-221` à jour avec `account.id`. | 1 ligne |
| Suivi | 7 | Test jumeau sur `resolveOAuthAccountKey` + test d'intégration du rejet de doublon sur l'index unique (§ 5, question 7). | ~25 lignes |
| Polish | 5 | Union discriminée sur `LoginMethods.google`, qui supprime le `return` muet. | ~6 lignes |
| Polish | 6, 7 | Retirer la règle `/forget-password` morte ; `.limit(10)` sur la lecture de `account`. | 2 lignes |

**Rappel** : le test manuel de l'étape 8 de l'issue #160 (inscription, connexion Google, liaison,
déliaison, suppression) reste indispensable — il est le seul à couvrir la réserve non tranchée sur
`requireLocalEmailVerified` (§ 4). Le faire **aussi depuis un compte au courriel non vérifié**.

---

## 7. Confirmations de sécurité opérationnelle

- **Lecture seule respectée.** Les seules commandes non consultatives ont été les deux gates
  autorisées, `bun run check` et `bun run test` (jamais `bun test`). Tout le reste : `git diff`,
  `git status`, `gh issue view 160`, `cat`, `sed`, `grep`, `find`, et deux `node -e` de comparaison
  pure sur des fichiers JSON locaux (`drizzle/meta/*_snapshot.json`) et sur la liste des endpoints
  admin.
- **Aucun fichier source modifié.** Le seul fichier écrit est ce rapport,
  `docs/superpowers/reviews/2026-09-03-revue-implementation-better-auth-1.7.md`. Il n'est **pas**
  commité — la session demanderesse décide de son sort.
- **Aucune base de données touchée.** Zéro requête, en lecture comme en écriture, sur la branche
  Neon de production (`br-blue-moon-adhu1l69`, projet `lucky-waterfall-33371811`) ni sur aucune
  autre. `bun run test:integration` n'a pas été lancé, donc aucune branche Neon éphémère n'a été
  créée. Aucune migration exécutée.
- **Aucun secret affiché.** Les fichiers `.env*` n'ont été ni ouverts, ni lus, ni cités — y compris
  le `.env` ouvert dans l'éditeur au démarrage de la session.
- **Aucun `bun install`**, aucun `node_modules` modifié : la parité a été établie en **lisant**
  l'arborescence installée (better-auth 1.7.2, `@better-auth/core` 1.7.2,
  `@better-auth/drizzle-adapter` 1.7.2 — versions confirmées dans leurs `package.json`).
- **Aucun serveur de développement lancé**, aucune commande destructive, aucun déploiement.
- **Un effet de bord à signaler** : un premier lancement de `bun run check` a échoué (code 1) sur
  une redirection shell fautive de ma part (`$TMPDIR` vide → `/check.log: Permission denied`), pas
  sur le code. Il a été relancé correctement et le code de sortie rapporté en en-tête est celui de
  ce second lancement. Aucun fichier n'a été créé hors du répertoire de travail temporaire de la
  session.
