# Revue d'implémentation — bannissement et retrait d'accès sur remboursement

## 1. En-tête

- **Date** : 2026-09-05
- **Périmètre** : `git diff origin/main...HEAD` sur `feat/bannissement`
  (worktree `C:\Users\samue\Downloads\Code\NOMAqBANK-bannissement`),
  12 commits, 41 fichiers, dont `cad6c8c` purement documentaire.
- **Méthode** : lecture seule, hostile. Chaque constat est prouvé par lecture du
  code (dépôt **et** `node_modules/better-auth`) avec référence `fichier:ligne` ;
  chaque suspicion a d'abord été attaquée pour être réfutée, et celles qui sont
  tombées sont consignées en §4. Aucun fichier source modifié, aucune écriture
  en base.
- **Statut du gate** :
  - `bun run check` → **exit 0** (prettier + `tsc --noEmit` + eslint `--max-warnings 0`)
  - `bun run test` → **exit 0** — 126 fichiers, **1427 tests passés**, 38 s
  - `bun run test:integration` **non lancé** (crée une branche Neon), comme demandé.

---

## 2. Constats, triés par sévérité

| #   | Sév | fichier:ligne | problème | régression ? |
| --- | --- | --- | --- | --- |
| 1 | 🟠 | `lib/auth.ts:84,97` + `node_modules/better-auth/dist/api/routes/sign-in.mjs:341-354` | La vérification d'adresse passe **avant** la création de session : un compte suspendu **non vérifié** reçoit encore un courriel de vérification à chaque tentative, et voit `EMAIL_NOT_VERIFIED` au lieu de `/compte-suspendu`. C'est exactement le profil (inscription frauduleuse jamais vérifiée) qu'on suspend. | NON |
| 2 | 🟡 | `features/users/actions.ts:203-223` vs `:271-273` | L'état incohérent **`banned = false` + épisode ouvert** est irrécupérable depuis l'admin : `banUser` échoue sur l'index unique (« déjà suspendu »), `unbanUser` refuse (« pas suspendu »). Le miroir (`banned = true` sans épisode) est, lui, explicitement rattrapé. | NON |
| 3 | 🟡 | `features/users/actions.ts:207-216` + `node_modules/better-auth/dist/plugins/admin/admin.mjs:34-49` | Le verrou porte sur `user`, pas sur `session` : une connexion concurrente au ban laisse une **session orpheline** vivante jusqu'à expiration. Serveur neutralisé par `lib/dal.ts:11-13`, mais `authClient.useSession()` la croit valide et `/api/auth/get-session` renvoie `user.banReason` (motif interne) à l'intéressé. | NON |
| 4 | 🟡 | `tests/integration/users-account.test.ts:379-413` | Le test « un admin suspendu ne compte pas » dérive son attendu de **la même requête** que l'implémentation : dès qu'un autre admin utilisable existe en base, il passe que le garde `eq(user.banned, false)` existe ou non. | NON |
| 5 | ℹ️ | `features/payments/stripe.ts:442` · `features/payments/actions.ts:241` · `db/schema/payments.ts:112-114` | `refunded_at` est écrit par deux chemins et **lu par aucun** (ni DAL, ni UI, ni export, ni alerte), sans backfill des `refunded` historiques. Constat ℹ️ 9 de la revue de design **non traité**. | NON |
| 6 | ℹ️ | `features/notifications/welcome.ts:15-26` (branche `feat/socle-courriels`) | Au merge, le seul des trois nouveaux expéditeurs sans garde `banned = false`. | NON (merge à venir) |
| 7 | ℹ️ | `tests/components/admin/UserBanSection.test.tsx:18-20` | Mock **partiel** de `next/navigation` + `callAction` réel : aucun test du rejet réseau, et en ajouter un heurterait le piège documenté dans `.claude/rules/data-layer.md`. | NON |
| 8 | ℹ️ | `app/(auth)/compte-suspendu/page.tsx:18` | Page statique : `env.SUPPORT_EMAIL` est figé **au build**. Ajouter la variable sans redéployer laisse le repli en place, silencieusement. | NON |

---

## 3. Détail par constat

### 🟠 1 — Un compte suspendu non vérifié reçoit encore des courriels et n'atteint jamais `/compte-suspendu`

**Code**

- `lib/auth.ts:84` `requireEmailVerification: true` ; `lib/auth.ts:97` `sendOnSignIn: true`.
- `node_modules/better-auth/dist/api/routes/sign-in.mjs:341-352` : si
  `!user.emailVerified`, better-auth **renvoie le lien de vérification**
  (`:346`) puis lève `EMAIL_NOT_VERIFIED` (`:352`).
- `node_modules/better-auth/dist/api/routes/sign-in.mjs:354` :
  `internalAdapter.createSession(...)` — c'est **seulement ici** que le hook
  `session.create.before` du plugin admin
  (`node_modules/better-auth/dist/plugins/admin/admin.mjs:34-49`) lève
  `BANNED_USER`.
- Côté UI : `app/(auth)/connexion/_components/sign-in-form.tsx:46-49` branche
  sur `email_not_verified` **avant** `banned` (`:53-57`) — l'écran
  `CheckEmailNotice` s'affiche, jamais `/compte-suspendu`.

**Pourquoi c'est un vrai bug.** Le commit `bbc6992` s'intitule « aucun courriel
aux comptes suspendus » et `.claude/rules/data-layer.md` (ajout de cette
branche) énonce « tout expéditeur … filtre `banned = false` ». Or le profil le
plus banni en pratique — une inscription frauduleuse qui n'a jamais validé son
adresse — déclenche un envoi SES **à chaque tentative de connexion** (borné à
3/min par `lib/auth.ts:24`). Et l'utilisateur reçoit un message qui l'invite à
vérifier son adresse : il vérifie, puis se heurte à `BANNED_USER`. Même
famille : `/request-password-reset` (`lib/auth.ts:85-87`) n'a aucun garde
`banned`.

**Régression ?** NON — comportement nouveau, incomplet, pas une perte.

**Comment je l'ai prouvé.**
`grep -n "sendOnSignIn\|EMAIL_NOT_VERIFIED\|createSession" node_modules/better-auth/dist/api/routes/sign-in.mjs`
→ `341`, `342`, `346`, `352`, puis `354`. Les trois premiers sortent de la
fonction par `throw` avant d'atteindre `354` : le hook du plugin n'est jamais
exécuté pour un compte non vérifié.

**Correction suggérée.** Au choix :

1. Un hook `before` sur l'endpoint (`hooks.before`, matcher
   `path === "/sign-in/email"`) qui lit `banned` et lève
   `APIError.from("FORBIDDEN", { code: "BANNED_USER" })` avant la logique de
   vérification. Le même hook couvre `/request-password-reset` et
   `/send-verification-email`.
2. À défaut, ranger explicitement le cas hors périmètre dans la spec — il n'y
   est pas aujourd'hui, alors que le voisin « courriel au compte suspendu ou
   levé » y est (`…-design.md:503`).

---

### 🟡 2 — L'état « drapeau levé, épisode ouvert » est un cul-de-sac administratif

**Code**

- `features/users/actions.ts:203-205` : `banUser` refuse si
  `locked.target.banned`. Ici `banned = false`, donc on **continue**.
- `features/users/actions.ts:207-211` : `tx.insert(userBans)` → viole
  `user_bans_active_uidx` (`db/schema/auth.ts:167-169`,
  `drizzle/0017_user_bans.sql:17`) puisqu'un épisode ouvert existe.
- `features/users/actions.ts:220-223` : le `catch` mappe `23505` en « Ce compte
  est déjà suspendu. » — message **faux** ici, et l'action échoue.
- `features/users/actions.ts:271-273` : `unbanUser` refuse d'entrée si
  `!locked.target.banned` → « Ce compte n'est pas suspendu. »

**Pourquoi c'est un vrai bug.** Les deux actions se renvoient dos à dos : aucun
chemin de l'admin ne répare l'état, il faut du SQL. L'asymétrie est frappante
parce que le miroir est traité **explicitement** :
`features/users/actions.ts:288,296-302` lève le drapeau et alerte quand
l'épisode manque (« un journal cassé ne doit pas bloquer la levée »).

**Est-ce atteignable ?** Pas par le code d'aujourd'hui — `banUser` et
`unbanUser` écrivent drapeau et journal dans la même transaction. Mais le
chemin existe **dans la dépendance** :
`node_modules/better-auth/dist/plugins/admin/admin.mjs:36-42` remet
`banned: false` tout seul dès que `user.banExpires` est passé, sans rien savoir
de `user_bans`. `ban_expires` (`db/schema/auth.ts:30`) est présent en base,
n'est écrit par aucun code applicatif, et le « ban temporaire » est rangé hors
périmètre — c'est donc une trappe pour la prochaine campagne, pas un bug
d'aujourd'hui.

**Régression ?** NON.

**Comment je l'ai prouvé.** Lecture croisée des trois gardes
(`grep -n "target.banned" features/users/actions.ts` → `140`, `203`, `271`) et
de `lib/db-errors.ts:19-20` (`isPgUniqueViolation` = SQLSTATE `23505`, remonté
via la chaîne `cause` sur 5 niveaux) : l'insert violant l'index partiel tombe
bien dans ce `catch`.

**Correction suggérée.** Dans `banUser`, avant l'insert, clore un éventuel
épisode orphelin (`UPDATE user_bans SET lifted_at = now(), lift_reason =
'incohérence rattrapée' WHERE user_id = ? AND lifted_at IS NULL`) +
`captureServerError` — symétrique du rattrapage déjà écrit dans `unbanUser`.
Deux lignes, et la trappe `ban_expires` disparaît.

---

### 🟡 3 — Session orpheline au ban : le client se croit connecté, et reçoit le motif interne

**Code**

- `features/users/actions.ts:190-216` : `lockCallerAndTarget` prend
  `SELECT … FROM "user" … FOR UPDATE` (`:77-88`), puis `:216`
  `tx.delete(sessionTable).where(eq(sessionTable.userId, targetId))`. Aucune
  ligne `session` n'est verrouillée.
- `node_modules/better-auth/dist/plugins/admin/admin.mjs:35` : le hook lit
  l'utilisateur par `internalAdapter.findUserById(session.userId)` — un `SELECT`
  **hors** de notre transaction. En READ COMMITTED il voit `banned = false` tant
  que le ban n'a pas commité.
- `node_modules/better-auth/dist/db/with-hooks.mjs:8-27` : les hooks `before`
  puis l'`INSERT` de session s'enchaînent ; si l'`INSERT` tombe **après** notre
  `DELETE` et **avant** notre `COMMIT`, la ligne survit.
- Côté serveur, `lib/dal.ts:11-13` neutralise le tout (`session.user.banned` ⇒
  `null`) et c'est le **seul** point d'entrée
  (`grep -rn "auth\.api\.getSession"` → une occurrence, `lib/dal.ts:11`).
- Côté client, non : `hooks/useCurrentUser.ts:14` → `authClient.useSession()` →
  route `/api/auth/get-session`, qui répond
  `parseUserOutput(options, session.user)`
  (`node_modules/better-auth/dist/api/routes/session.mjs:165`) — un filtre par
  schéma, et `banReason`
  (`node_modules/better-auth/dist/plugins/admin/schema.mjs:16-19`) n'est pas
  marqué `returned: false`.

**Pourquoi c'est un vrai bug.** Deux effets distincts :

- (a) l'en-tête (`components/marketing-header/index.tsx:38`) affiche le compte
  comme connecté alors que chaque page serveur le renvoie à `/connexion` ;
- (b) le motif de suspension — que `UserBanSection` qualifie d'interne et que la
  page `/compte-suspendu` s'interdit d'afficher — transite vers le navigateur du
  banni.

La protection réelle n'est donc pas la projection `lib/session-user.ts:18-23`
(qui ne couvre que le chemin serveur→client) mais la suppression des sessions ;
dès qu'une session survit, la projection ne joue plus.

**Régression ?** NON.

**Comment je l'ai prouvé.** Lecture de `with-hooks.mjs:8-27` (ordre
hooks → `adapter.create`) et de `admin.mjs:35` (`findUserById`, sans
`FOR UPDATE`, hors de notre transaction) ; `grep -rn "auth\.api\.getSession"`
pour établir que `lib/dal.ts` est bien l'unique porte serveur.

**Correction suggérée.** Fenêtre étroite et sans conséquence d'accès : ne pas
sur-corriger. Deux gestes bon marché, au choix :

- déclarer `banReason: { type: "string", input: false, returned: false }` dans
  `user.additionalFields` (`lib/auth.ts:73-78`) — ferme (b) définitivement ;
- ou rejouer le `DELETE` juste après le `COMMIT`, hors transaction — ferme (a).

---

### 🟡 4 — Le test du décompte d'admins ne teste pas le garde qu'il est censé pinner

**Code** — `tests/integration/users-account.test.ts:394-413` :

```ts
const otherUsableAdmins = await db.select({ id: user.id }).from(user)
  .where(and(eq(user.role, "admin"), isNull(user.deletedAt),
             eq(user.banned, false), ne(user.id, adminA)))
…
expect(res.success).toBe(otherUsableAdmins.length > 0)
```

**Pourquoi c'est un vrai bug.** L'attendu est calculé par **la requête même**
qu'on veut vérifier (`features/users/actions.ts:580-592`). Si le garde
`eq(user.banned, false)` disparaît de l'implémentation, le test ne le voit que
dans le cas où `otherUsableAdmins.length === 0`, c'est-à-dire quand `bannedB`
est le **seul** autre admin de la base. Or `tests/integration/` partage une
branche Neon avec `users-ban.test.ts` (3 admins de fixture) et
`users-role.test.ts` ; selon l'ordre d'exécution et l'état des `afterAll`, la
branche discriminante peut ne jamais être empruntée. C'est précisément le motif
« écrire par paires jumelles » retenu après la campagne vitest-audit.

**Régression ?** NON (test neuf).

**Comment je l'ai prouvé.** Lecture du test et de
`features/users/actions.ts:580-592` : les deux `where` sont littéralement les
mêmes prédicats. Aucune assertion n'est indépendante de l'implémentation.

**Correction suggérée.** Fixer l'univers au lieu de le mesurer : créer A et B et
suspendre temporairement les autres admins actifs, puis asserter **en dur**
`expect(res.success).toBe(false)` — et la jumelle : `bannedB` non suspendu ⇒
`expect(res.success).toBe(true)`.

---

### ℹ️ 5 — `refunded_at` : écrit deux fois, lu nulle part, sans backfill

**Code** — écritures : `features/payments/stripe.ts:442`
(`.set({ status: "refunded", refundedAt: params.refundedAt })`) et
`features/payments/actions.ts:239-242`. Colonne : `db/schema/payments.ts:112-114`,
`drizzle/0017_user_bans.sql:11`.

**Pourquoi c'est un vrai (petit) problème.**
`grep -rn "refundedAt\|refunded_at" app lib features components db tests` ne
renvoie, hors écritures et tests, **aucune** lecture : ni
`features/payments/dal.ts` (`getAllTransactions`), ni l'UI admin, ni
`getUsersForExport`, ni une alerte. La colonne n'est donc pas observable — et
comme la migration ne backfille rien, les transactions déjà `refunded`
resteront à `NULL` pour toujours, ce qui interdit tout usage analytique
ultérieur sans retraitement. La revue de design l'avait soulevé (constat ℹ️ 9) ;
l'implémentation ne l'a pas traité.

**Régression ?** NON.

**Correction suggérée.** Soit exposer la date (une colonne dans la table des
transactions admin), soit assumer qu'elle est une donnée d'archive et le **dire**
dans le commentaire de schéma (`db/schema/payments.ts:112-113` dit « date du
retour de fonds », pas « écrite pour l'audit, lue par personne »). Le backfill
(`UPDATE transactions SET refunded_at = completed_at WHERE status = 'refunded'
AND refunded_at IS NULL`) n'a de sens que dans la première branche.

---

### ℹ️ 6 — `welcome.ts` (autre branche) n'aura pas le garde `banned` au merge

**Code** — `git show feat/socle-courriels:features/notifications/welcome.ts:15-26` :

```ts
.update(user).set({ welcomeEmailSentAt: new Date() })
.where(and(eq(user.id, userId), isNull(user.welcomeEmailSentAt), isNull(user.deletedAt)))
```

**Pourquoi c'est un vrai problème.** La doctrine que **cette** branche ajoute
(`.claude/rules/data-layer.md`, dernier point) exige `banned = false` « au même
endroit que `isNull(user.deletedAt)` », « sans poser de marqueur ». Les deux
autres nouveaux expéditeurs de `feat/socle-courriels` sont conformes —
`abandoned-cart.ts:41` teste `row.banned`, `cron.ts:211`
(`sendInactivityReminders`) porte déjà `eq(user.banned, false)`. Seul
`welcome.ts` manque. Bonne nouvelle : comme son `UPDATE … RETURNING` **est** le
claim, ajouter `eq(user.banned, false)` au `where` suffit — la ligne n'est alors
pas claimée du tout et le courriel repart à la levée, exactement le
comportement demandé.

**Régression ?** NON (concerne le merge à venir).

**Correction suggérée.** Ajouter `eq(user.banned, false)` au `where` de
`sendWelcomeEmailOnce` **et** un cas de test « compte suspendu exclu », au
moment du merge. Voir §5 Q11 pour le reste des zones de conflit.

---

### ℹ️ 7 — Le test `UserBanSection` ne couvre pas le rejet réseau, et le mock l'en empêche

**Code** — `tests/components/admin/UserBanSection.test.tsx:18-20` mocke
`next/navigation` avec le seul `useRouter` ; le composant appelle le vrai
`callAction` (`app/(admin)/admin/utilisateurs/[id]/_components/user-ban-section.tsx:83-88`),
dont le `catch` (`lib/safe-action.ts:47`) invoque
`unstable_isUnrecognizedActionError`.

**Pourquoi c'est un vrai (petit) problème.** Les cinq tests existants ne font
que **résoudre** les actions, donc le `catch` n'est jamais atteint et la suite
est verte. Mais l'un des chemins que `callAction` existe pour couvrir (perte
réseau → toast, dialogue conservé) n'est pas testé, et l'ajouter ferait tomber
le test sur l'erreur cryptique du proxy Vitest décrite dans
`.claude/rules/data-layer.md`.

**Régression ?** NON.

**Correction suggérée.** Passer le mock en `importOriginal` (ou ajouter
`unstable_isUnrecognizedActionError: () => false`) et ajouter un test
`mocks.banUser.mockRejectedValue(new TypeError("Failed to fetch"))` ⇒
`toastError(NETWORK_ERROR_MESSAGE)` + dialogue toujours ouvert.

---

### ℹ️ 8 — `/compte-suspendu` : `SUPPORT_EMAIL` figé au build

**Code** — `app/(auth)/compte-suspendu/page.tsx:18`
(`env.SUPPORT_EMAIL ?? FALLBACK_SUPPORT_EMAIL`, repli défini `:13`). La page
n'utilise aucune API dynamique → elle est **prérendue statiquement**. Les deux
autres lectures de `@/lib/env/server` dans `app/`
(`app/(admin)/admin/profil/page.tsx:13`,
`app/(dashboard)/tableau-de-bord/profil/page.tsx:9`) sont dans des segments
dynamiques (garde de session), donc évaluées à chaque requête.

**Pourquoi c'est un vrai (petit) problème.** `SUPPORT_EMAIL` est optionnelle
(`lib/env/schema.ts:44`). Si elle est ajoutée dans Vercel après ce déploiement,
la page continuera d'afficher le repli jusqu'au prochain build, sans signal.

**Régression ?** NON. **Correction suggérée.** Rien d'obligatoire ; si on veut
la robustesse, `export const dynamic = "force-dynamic"`.

---

## 4. Faux positifs écartés

| Suspicion | Verdict et preuve |
| --- | --- |
| Le `databaseHooks.session.create.before` de `lib/auth.ts:45-54` **écrase** celui du plugin admin ⇒ le ban ne bloque jamais une connexion | **Écarté.** `context/helpers.mjs:14-31` empile les `databaseHooks` de chaque plugin dans un tableau `dbHooks`, puis (`:43-46`) ceux de l'utilisateur ; `db/with-hooks.mjs:8-21` les exécute **tous**, dans l'ordre, et propage l'exception. Le `defu(options, restOpts)` de `:28` reçoit un objet dont `databaseHooks` a été **destructuré hors** (`:22`). |
| Le code d'erreur OAuth n'est pas littéralement `BANNED_USER` ⇒ `OAuthErrorHandler` a une branche morte | **Écarté.** `plugins/admin/admin.mjs:44-48` lève `APIError.from("FORBIDDEN", { code: "BANNED_USER" })` ; `oauth2/link-account.mjs:268` n'entoure pas `createSession` d'un `catch` ; `api/routes/callback.mjs:241-243` fait `redirectOnError(e.body.code, e.body.message)` et `:76-82` construit `?error=<code>` sur `errorURL`, alimenté par `oauth2/state.mjs:27` (`c.body?.errorCallbackURL`). Le test `tests/components/auth/sign-in-form.test.tsx:87-94` verrouille l'envoi de `errorCallbackURL`. |
| `eq(user.banned, false)` rate les lignes historiques à `NULL` (deux crons + `deleteMyAccount`) | **Écarté.** `db/schema/auth.ts:28` et `drizzle/0002_certain_loki.sql:13` : `banned boolean DEFAULT false NOT NULL` depuis l'origine. Aucun `NULL` possible en base. (Côté session Better Auth, `banned` peut être `null`/`undefined` — `lib/dal.ts:12` teste la véracité, pas l'égalité, et `tests/lib/dal.test.ts:26-31` le couvre.) |
| `refundStripeTransaction` peut rembourser la **mauvaise** transaction (`.limit(1)` sans `orderBy`, `stripe_payment_intent_id` non unique) | **Écarté.** Cette colonne n'est écrite qu'en un point, `features/payments/stripe.ts:197` — `params.stripePaymentIntentId \|\| null`, donc jamais `""` — sur la ligne trouvée par `stripe_session_id`. Une session Checkout ⇒ un PaymentIntent ⇒ une ligne. Deux lignes ne peuvent pas partager un PI non nul. |
| Le double `SELECT … FOR UPDATE` sur `user` (`stripe.ts:435-438` puis `lib.ts:202-206` dans `recomputeAccess`) interbloque ou réclame une 2ᵉ connexion | **Écarté.** Même transaction, même ligne : le verrou est déjà détenu, la seconde acquisition est un no-op. Et `recomputeAccess` reçoit `tx` en paramètre (`lib.ts:196-199`), il ne touche jamais le `db` global — pas de piège `max: 5` (`.claude/rules/data-layer.md`). |
| Course « `pending` au premier `SELECT`, `completed` à l'`UPDATE` » ⇒ remboursement perdu (question 3) | **Écarté.** Le `SELECT` de `stripe.ts:421-431` n'a **aucune autorité** : il ne sert qu'à obtenir `id` et `userId`. L'autorité est l'`UPDATE … WHERE id = ? AND status = 'completed'` (`:441-448`), exécuté **après** le verrou `user` (`:435-438`) qui sérialise avec `completeStripeTransaction` (`:104-111`). En READ COMMITTED l'`UPDATE` réévalue son `WHERE` sur la version committée la plus récente. Le sens inverse relit sous verrou (`:452-456`) et rend `skipped`. |
| L'`it.each` existant de `charge.dispute.closed` a été desserré pour laisser passer la nouvelle alerte | **Écarté.** `git show origin/main:tests/features/stripe-webhook-errors.test.ts` et la version courante sont **identiques** sur `:356-387` : même `mock.calls[0]`, même `detail` sans suffixe, même assertion sur `recordDispute`. La seconde alerte est asserttée séparément (`:800-815`). Suite verte. |
| Le refactor `lockCallerAndTarget` change le comportement d'`updateUserRole` | **Écarté.** Ordre des contrôles (appelant puis cible), messages et `orderBy(user.id).for("update")` identiques ; seule `banned` s'ajoute au `select` (`features/users/actions.ts:71-76`). Le nouveau refus (`:140-145`) est **postérieur** au re-check d'admin et **antérieur** à l'écriture, et ne s'applique qu'à `role === "admin"`. `tests/integration/users-role.test.ts` couvre les cinq messages, inchangés. |
| `updateManualTransaction` : le passage par `statusChange` change le comportement quand `data.status === transaction.status` | **Écarté.** Avant, le `set` écrivait un statut **identique** ; maintenant il ne l'écrit pas — aucun effet observable. `recomputeAccess` était déjà conditionné par `data.status !== transaction.status` sur `origin/main`. Le garde `type !== "manual"` (`:214`) est inchangé, et `tests/integration/payments-refund.test.ts:241-258` couvre l'aller-retour `completed ↔ refunded`. |
| Interblocage entre `deleteMyAccount` (verrou multi-lignes) et `lockCallerAndTarget` | **Écarté.** Les deux trient par `user.id` (`features/users/actions.ts:86` et `:591`) et le nœud `LockRows` de Postgres est **au-dessus** du `Sort` : les lignes sont verrouillées dans l'ordre trié. Deux sous-ensembles verrouillés dans le même ordre global ne peuvent pas se croiser. |
| `getUserBans` viole la convention DAL (pas de `cache()`) | **Écarté.** Convention du fichier : les lecteurs **paramétrés** ne sont pas mémoïsés (`getUserForAdmin:571`, `getUserPanelData:642`, `getUsersWithFilters:286`) ; seuls ceux sans argument le sont (`:61`, `:99`, `:150`, `:189`). `getUserBans:726` est conforme, avec `requireRole` en tête (`:727`) et le `import "server-only"` du module. |
| L'épisode actif peut sortir de la fenêtre de 20 (`dal.ts:747`) et l'UI afficher « suspension sans épisode » | **Écarté.** L'index unique partiel (`db/schema/auth.ts:167-169`) garantit **au plus un** épisode ouvert, et on ne peut pas en ouvrir un second sans clore le premier (`actions.ts:203-205`) : l'épisode ouvert porte donc toujours le `bannedAt` le plus récent, donc toujours en tête du `orderBy(desc(bannedAt), desc(id))`. |
| Le motif interne (`user.ban_reason`) fuit par la projection serveur→client | **Écarté** sur ce chemin. `lib/session-user.ts:18-23` projette explicitement 4 champs ; `bannedUserMessage` (`lib/auth.ts:138`) est une constante, jamais `ban_reason` ; `AdminUserDetail` (`features/users/dal.ts:551-563`) ne porte pas `banReason`. Le seul chemin résiduel est celui du constat 3 (`/api/auth/get-session`). |
| Un remboursement partiel puis un second qui complète le total laisse l'accès en place | **Écarté.** Dans les types installés, `Charge.refunded` = « fully refunded » (faux tant que le remboursement est partiel). Le second événement porte donc `refunded: true` et passe le filtre `app/api/stripe/webhook/route.ts:339` : retrait d'accès au bon moment. |
| L'alerte détaillée manque quand `refundStripeTransaction` lève | **Écarté.** `route.ts:348-352` précède `:353-356`, et le test `tests/features/stripe-webhook-errors.test.ts:645-659` asserte à la fois le 500 et le `detail` de la première capture. |
| Un litige perdu passe aussi par `charge.refunded` ⇒ double retrait | **Écarté.** Même si les deux événements arrivaient, le second retombe en `skipped: "refunded"` (`stripe.ts:441-458`) : aucun double retrait, et `reportRefundOutcome:104-117` n'alerte pas sur ce cas. |
| Les nouvelles FK cassent le nettoyage des tests ou la suppression de compte | **Écarté.** `user_bans.user_id` est `ON DELETE cascade` et `banned_by`/`lifted_by` sont `ON DELETE set null` (`drizzle/0017_user_bans.sql:13-15`) : aucune `restrict`, donc aucun `23001` possible sur un `DELETE FROM "user"`. |
| La couverture tombe sous le seuil de 80 % avec tout ce code neuf | **Écarté.** `bun run test` est vert, et `vitest.config.ts` limite le périmètre de couverture à `lib/**`, `hooks/**`, `components/**`, `schemas/**`, `email/**` : `features/**` et `app/**` en sont exclus. Le seul fichier neuf concerné, `lib/auth-errors.ts`, est couvert (`tests/lib/auth-errors.test.ts`). |
| Le cookie mort provoque une boucle `/` → `/tableau-de-bord` → `/connexion` | **Écarté.** Un seul aller-retour : `proxy.ts:62-64` renvoie sur `/tableau-de-bord`, `app/(dashboard)/layout.tsx:12` renvoie sur `/connexion`, et cette page purge le cookie (voir Q1). `/connexion` n'est pas dans `PUBLIC_ONLY` (`proxy.ts:9`). |

---

## 5. Réponses aux questions ouvertes

**1. `getCurrentSession` renvoie `null` si `banned` — un consommateur peut-il en
déduire du faux ? Le cookie mort est-il purgé ?**

Le choix est bon et **complet côté serveur** : `grep -rn "auth\.api\.getSession"`
ne renvoie qu'une occurrence (`lib/dal.ts:11`), et tous les gardes
(`lib/auth-guards.ts:7,14,22`) en dérivent. Sur les deux déductions citées :

- `hasAccess` (`features/payments/dal.ts:83-89`) : un admin suspendu obtient
  `false` au lieu du court-circuit `true` du `:87`. C'est **correct**, pas faux —
  un admin suspendu ne doit rien consulter, et `requireRole` l'aurait de toute
  façon redirigé avant.
- Pages marketing : `proxy.ts:62-64` redirige `/` → `/tableau-de-bord` sur la
  seule **présence** du cookie ; `/tableau-de-bord` renvoie alors vers
  `/connexion`. Un aller-retour, pas une boucle.

Le cookie mort **est** purgé, mais indirectement : `/connexion` et
`/compte-suspendu` sont sous `app/(auth)/layout.tsx:8` → `MarketingShell` →
`MarketingHeader` (`components/marketing-header/index.tsx:38`) →
`useCurrentUser` → `authClient.useSession()` → `GET /api/auth/get-session`, et
`node_modules/better-auth/dist/api/routes/session.mjs:147-149` appelle
`deleteSessionCookie(ctx)` quand la session est introuvable. C'est un **route
handler**, donc le `Set-Cookie` passe — ce ne serait pas le cas depuis un Server
Component. Le mécanisme tient, mais il est implicite : il repose sur le fait que
le header marketing monte `useCurrentUser`. Une ligne de commentaire dans
`lib/dal.ts` le dirait mieux que ce rapport.

**2. `banUser` : une session créée entre le verrou et le `DELETE` survit-elle ?
Le hook relit-il `banned` après notre commit ?**

**Oui elle survit, et le hook lit avant.** `plugins/admin/admin.mjs:35` fait
`internalAdapter.findUserById(...)`, un `SELECT` ordinaire hors de notre
transaction : en READ COMMITTED il voit `banned = false` tant que `banUser` n'a
pas commité, et `db/with-hooks.mjs:25-27` enchaîne l'`INSERT` de session. Si cet
`INSERT` tombe entre notre `DELETE` (`actions.ts:216`) et notre `COMMIT`, la
ligne n'est pas emportée. Le `FOR UPDATE` sur `user` n'y change rien : le hook
ne le demande jamais.

Le filet est `lib/dal.ts:11-13`, et il tient — mais seulement côté serveur. Voir
le constat 🟡 3 pour les deux effets résiduels. **Je ne recommande pas** de
durcir la course elle-même (verrouiller `session` supposerait de toucher au
plugin) ; un `DELETE` rejoué après commit suffit si on veut fermer.

**3. `refundStripeTransaction` : `pending` → `completed` entre le `SELECT` et
l'`UPDATE` ? L'inverse ? Double verrou `user` ?**

Les trois sont sûrs (détail en §4). En résumé : le premier `SELECT`
(`stripe.ts:421-431`) n'a aucune autorité, il ne sert qu'à obtenir `id` et
`userId` ; le verrou `user` (`:435-438`) sérialise avec
`completeStripeTransaction` (`:104-111`), `grantManualAccess` (`lib.ts:59-64`) et
`updateManualTransaction` (`actions.ts:225-229`) ; l'`UPDATE` gardé (`:441-448`)
réévalue son `WHERE` sur la version committée la plus récente — donc **oui**, une
transaction devenue `completed` entre-temps est bien remboursée. Le rejeu
concurrent relit sous verrou (`:452-456`) et rend `skipped: "refunded"`. Le
second verrou pris par `recomputeAccess` (`lib.ts:202-206`) porte sur une ligne
déjà verrouillée par la **même** transaction : no-op, et pas de seconde connexion
au pool puisqu'il reçoit `tx`.

**4. `charge.refunded` : promo 100 %, XAF, `payment_intent` partagé ?**

- **Promo 100 %** (`no_payment_required`) : aucune charge, donc aucun
  `charge.refunded` possible ; et la ligne porte `stripe_payment_intent_id = NULL`
  (`stripe.ts:197`). Les deux ensembles sont disjoints — rien à faire.
- **XAF** : `charge.amount_refunded` / `charge.amount` sont recopiés **bruts**
  dans le `detail` (`route.ts:329`), donc en francs entiers, avec la devise à
  côté. Lisible, mais attention à l'usage : un opérateur qui compare l'alerte
  (`228000 xaf`) à `transactions.amount_paid` (`22800000`, ×100 par
  `stripe.ts:160-161`) verra un facteur 100. Ce n'est pas un bug — l'alerte est un
  écho Stripe fidèle — mais ça mérite une ligne dans `payments.md` le jour où un
  prix sera **réellement** libellé en XAF.
- **PI partagé par deux transactions** : impossible par construction (§4).

**5. Deux événements Sentry pour un incident : acceptable ?**

Oui, **ne rien dédupliquer**. Les deux captures ne portent pas la même
information : la première (`route.ts:348-352`) porte le détail Stripe complet et
part avant toute écriture ; la seconde (`route.ts:402`) ne porte que `event.type`
mais atteste du 500, donc du retry. C'est exactement l'invariant que la revue de
design a fait corriger — dédupliquer reviendrait à choisir entre le détail et la
preuve de l'échec. Le coût réel (un événement Sentry par remboursement
**réussi**) est déjà celui des litiges (`route.ts:236-258`) : cohérent, assumé,
et le volume est faible.

**6. `OAuthErrorHandler` : le toast survit-il au `replace` ? Boucle possible ?**

Oui, et non.

- `router.replace("/connexion")` depuis `/connexion` est une navigation **soft** :
  l'arbre React n'est pas démonté, le `<Toaster/>` de sonner reste monté, et le
  toast est émis **avant** le `replace` (`oauth-error-handler.tsx:20-21`). Il
  reste affiché.
- Pas de boucle : après le `replace`, `useSearchParams().get("error")` vaut
  `null`, l'effet re-tourne et sort sur `if (!error) return` (`:15`). Le `replace`
  pose l'URL littérale `/connexion`, sans query — `error_description`, ajouté par
  better-auth (`callback.mjs:79-80`), disparaît aussi.
- Le `<Suspense>` de `app/(auth)/connexion/page.tsx:141-143` est nécessaire et
  bien placé (sinon `useSearchParams` bascule la page en rendu dynamique).

**7. `/compte-suspendu` : cohérent avec le reste et avec robots/sitemap ?**

- **`env`** : cohérent sur le fond (deux autres pages lisent `SUPPORT_EMAIL`),
  avec la nuance du constat ℹ️ 8 — ces deux-là sont dynamiques, celle-ci est
  prérendue.
- **`sitemap`** : `app/sitemap.ts` est une **liste blanche** de 9 pages écrite à
  la main ; `/compte-suspendu` n'y est pas. Rien à faire.
- **`robots`** : `app/robots.ts:11-17` interdit les 6 routes d'auth mais pas
  `/compte-suspendu`. Ce n'est **pas** une omission gênante : la page porte
  `robots: { index: false, follow: false }` (`page.tsx:9`), plus fort qu'un
  `Disallow` (lequel empêche le crawl, pas l'indexation). Ajouter la ligne au
  `disallow` par uniformité est facultatif.

**8. `getUserBans` borné à 20 sans indicateur de troncature : problème réel ?**

Non, très marginal — mais le corriger coûte une ligne. L'épisode **actif** est
toujours affiché (preuve en §4) : la décision d'un admin n'est donc jamais prise
sur une donnée manquante, seul l'historique ancien est coupé. Atteindre
21 épisodes suppose 21 bans/levées sur le même compte. Si tu veux fermer :
`.limit(21)` puis « … et N épisodes plus anciens » quand `bans.length === 21`.

**9. Sélecteurs admin qui listent encore les bannis, paiement manuel possible :
état incohérent ?**

Confirmé : **aucun état incohérent n'en découle**, et c'est explicitement rangé
hors périmètre (`…-design.md:509-511`). Un octroi manuel à un banni écrit
`user_access` normalement ; l'accès est simplement inatteignable tant que
`getCurrentSession` renvoie `null`, et il redevient utilisable tel quel à la
levée — exactement la sémantique « gel réversible » de la campagne. Le seul
inconfort est ergonomique : rien ne signale à l'admin, dans le sélecteur de
`recordManualPayment`, que la cible est suspendue (`getSelectableUsers`,
`features/users/dal.ts:189`, ne sélectionne pas `banned`). À laisser tel quel.

**10. Ban pendant un examen en cours ; budget-temps et cron.**

**Non couvert par les tests**, et le comportement mérite d'être connu :
`tests/integration/users-ban.test.ts` vérifie que l'accès survit (`:206`, `:312`)
mais rien sur une participation `in_progress`. Par lecture du code :

- `banUser` supprime les sessions (`actions.ts:216`) → le `saveExamAnswer` suivant
  part avec un cookie mort, `requireSession` redirige, l'écriture n'aboutit pas.
  Aucune corruption : le moteur quiz traite tout throw de callback comme
  `{ ok: false }` et sérialise les envois par question
  (`.claude/rules/data-layer.md`).
- La participation reste `in_progress`. Le budget-temps anti-triche
  (`startedAt + completionTime + grâce`) continue de courir pendant la suspension :
  à la levée, l'examen est **perdu**, et le cron `close-expired` le passera en
  `auto_submitted` avec les réponses déjà enregistrées. Défendable pour un ban
  légitime, moins pour un ban levé par erreur — mais le rattrapage est humain et
  hors périmètre.

Recommandation : **un** test d'intégration qui pose ce comportement
(participation `in_progress` + ban ⇒ participation intacte, `saveExamAnswer`
refusé), pour que personne ne le « corrige » par accident plus tard. Pas de
changement de code.

**11. Merge avec `feat/socle-courriels` — zones de conflit et ce que chaque côté
doit garder.**

`git diff --stat origin/main...feat/socle-courriels` sur les fichiers communs
donne 6 points de contact. Par ordre de risque :

| Fichier | Risque | Ce qui doit survivre des deux côtés |
| --- | --- | --- |
| `tests/features/stripe-webhook-errors.test.ts` | **Conflit certain** | Les deux branches ajoutent une clé au `vi.hoisted({ mocks })` **et** à la factory `vi.mock("@/features/payments/stripe")`. Garder `refund` (ban) **et** les mocks du panier abandonné (socle) — deux lignes chacune, pas un choix. |
| `app/api/stripe/webhook/route.ts` | Élevé | Bloc d'`import` commun. Côté ban : `type RefundStripeResult`, `refundStripeTransaction`, les helpers `describeRefund`/`reportRefundOutcome`, le `case "charge.refunded"` et le bloc `dispute.status === "lost"`. Côté socle : le rappel de panier sur `checkout.session.expired`. Les deux `case` sont **disjoints** — tout se garde. |
| `features/payments/stripe.ts` | Moyen | Ligne d'import (`import { recomputeAccess } from "./lib"`, ban) vs ajouts socle. `refundStripeTransaction` est en fin de fichier, hors zone socle. |
| `features/notifications/cron.ts` | Faible mais **piégeux** | Le ban ajoute `eq(user.banned, false)` après `isNull(user.deletedAt)` dans les deux `where` existants (`:51`, `:122`) ; socle laisse ces lignes intactes et insère `sendInactivityReminders` après. Git fusionnera proprement — mais **vérifier après merge** que les deux `where` d'origine ont bien reçu le garde, en plus de celui déjà présent dans `sendInactivityReminders` (`socle:211`). |
| `lib/auth.ts` | Faible | Le ban touche le bloc `plugins:` (`:132-139`) ; socle touche `databaseHooks` (`:42-70`) et `emailAndPassword`. Zones disjointes. |
| `.claude/rules/payments.md` | Faible | Le ban réécrit le 1ᵉʳ point de « Litiges » (`:39-45`) ; socle insère un point après celui du courriel de confirmation (`:69`). Disjoint. |

Et le point de fond, hors conflit textuel : **`features/notifications/welcome.ts`
n'a pas le garde `banned`** (constat ℹ️ 6). C'est le seul écart réel entre la
doctrine que cette branche écrit et le code de l'autre.

---

## 6. Verdict

### Cette branche est-elle prête pour une PR vers `main` ? — **OUI**, sans point bloquant.

Les deux gates sont verts, et les 11 constats de la revue de design ont été
vérifiés un par un : l'`it.each` `charge.dispute.closed` est **littéralement
inchangé** et vert ; l'alerte « litige perdu » précède bien les deux écritures ;
un retour de fonds sur `pending`/`failed` alerte au lieu d'être avalé ;
`updateUserRole` / `deleteMyAccount` sont gardés ; le `db.delete(userBans)` du
`beforeEach` est borné aux fixtures ; le cas « auteur disparu » passe par le vrai
cron d'anonymisation. **Une exception : le constat ℹ️ 9 de la revue de design
(`refunded_at` lu par personne) reste vrai**, repris ici en constat 5.

Ce que j'ai trouvé de neuf ne bloque pas : un trou fonctionnel réel mais
périphérique (🟠 1, les courriels d'authentification d'un banni non vérifié),
trois durcissements (🟡 2-4) et quatre notes. Aucune fuite de données
exploitable, aucun contournement du ban côté serveur, aucune corruption possible,
aucune régression détectée sur les six zones sensibles du brief.

**Réserve de forme** : l'implémentation n'a pas encore été passée au navigateur
(la spec le prévoit, `…-design.md:491-500`) et il n'existe aucune spec Playwright
pour le parcours de ban. La PR peut s'ouvrir, mais le merge devrait attendre ce
test manuel — c'est le seul endroit où l'abonnement de l'endpoint Stripe **live**
à `charge.refunded` (constat 🔴 2 de la revue de design, déclaré fait au Dashboard
le 2026-09-05) peut être confirmé autrement que sur parole : `stripe listen`
relaie tout et ne prouve rien.

### Corrections priorisées

| Quand | # | Correction |
| --- | --- | --- |
| **Bloquant maintenant** | — | *(aucun)* |
| **Avant la PR** | 1 | Trancher le 🟠 1 : soit un hook `before` sur `/sign-in/email` (+ reset), soit une ligne « Hors périmètre » dans la spec. Ne pas laisser le commit `bbc6992` promettre plus que le code. |
| | 6 | Noter dans la description de PR que `welcome.ts` devra recevoir `eq(user.banned, false)` + son test au merge de `feat/socle-courriels`. |
| **Avant le merge** | — | Test manuel navigateur du parcours de ban (deux navigateurs) **et** du remboursement complet avec `stripe listen`, comme prévu par la spec. |
| | 4 | Rendre le test « admin suspendu ne compte pas » indépendant de l'état ambiant de la base (assertion en dur + jumelle). |
| | 10 | Ajouter le test « ban pendant un examen `in_progress` » (§5 Q10). |
| **Finition** | 2 | Rattrapage symétrique de l'épisode orphelin dans `banUser` (2 lignes) — ferme la trappe `ban_expires`. |
| | 3 | Au choix : `returned: false` sur `banReason`, ou `DELETE` de sessions rejoué après commit. |
| | 5 | Décider du sort de `refunded_at` : l'exposer, ou documenter qu'il est une donnée d'archive (et alors, backfill inutile). |
| | 7, 8 | Test du rejet réseau sur `UserBanSection` ; éventuellement `/compte-suspendu` en dynamique. |

---

## 7. Confirmations de sécurité opérationnelle

- **Lecture seule respectée.** Aucun fichier source, test, migration ou
  configuration modifié. Le seul fichier écrit est ce rapport,
  `docs/superpowers/reviews/2026-09-05-revue-implementation-bannissement.md`,
  **non committé**.
- **Commandes exécutées** : `git log`, `git diff`, `git show`, `git status`,
  lectures de fichiers (dépôt et `node_modules/better-auth`), recherches `grep`,
  et les deux gates autorisés `bun run check` et `bun run test`. Un
  `tsc --noEmit` isolé a été lancé via un fichier temporaire à la racine,
  **supprimé immédiatement après** (`rm -f ./__typecheck_tmp.ts`).
- **Non exécuté**, comme demandé : `bun run test:integration`, `db:migrate`,
  `db:generate`, `bun dev`. Aucun serveur de développement lancé.
- **Base de données** : aucune connexion applicative ouverte, aucune requête
  émise. Le MCP Neon n'a **pas** été utilisé, ni en lecture ni en écriture ; le
  projet `lucky-waterfall-33371811` et la branche `br-blue-moon-adhu1l69` n'ont
  reçu aucun appel.
- **Secrets** : `.env*` et `.credentials.json` n'ont été ni lus ni affichés.
  `SUPPORT_EMAIL` n'est citée que par son **nom** et son statut d'optionnalité
  (`lib/env/schema.ts:44`).
- **Aucune action externe** : rien de poussé, publié, déployé, ni envoyé à un
  service tiers.
