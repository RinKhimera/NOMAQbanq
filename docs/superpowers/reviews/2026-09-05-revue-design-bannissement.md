# Revue adversariale (conception) — Bannissement et retrait d'accès après remboursement

## 1. En-tête

- **Date** : 2026-09-05
- **Nature** : revue **avant implémentation**. Aucune ligne de code de cette
  campagne n'existe : la branche `feat/bannissement` (worktree
  `C:\Users\samue\Downloads\Code\NOMAqBANK-bannissement`) est à `033c5ff`
  (= `origin/main`), avec seulement la spec, le plan et ce rapport en fichiers
  non suivis.
- **Périmètre relu**
  - Spec : `docs/superpowers/specs/2026-09-05-bannissement-design.md` (436 l.)
  - Plan : `docs/superpowers/plans/2026-09-05-bannissement.md` (2576 l., 11 tâches)
  - Code **courant** confronté ancre par ancre : `db/schema/auth.ts`,
    `db/schema/payments.ts`, `db/schema/index.ts`, `db/schema/enums.ts`,
    `features/users/{actions,dal,cron}.ts`, `features/notifications/cron.ts`,
    `features/payments/{stripe,lib,actions,dal}.ts`,
    `app/api/stripe/webhook/route.ts`, `app/api/e2e/route.ts`,
    `lib/{dal,auth,auth-guards,auth-errors,session-user,ids,format}.ts`,
    `lib/env/schema.ts`, `proxy.ts`,
    `app/(auth)/{layout.tsx,connexion/page.tsx,connexion/_components/sign-in-form.tsx,inscription/_components/sign-up-form.tsx}`,
    `app/(admin)/admin/utilisateurs/**`, `components/ui/textarea.tsx`,
    `components/shared/{marketing-shell,footer}.tsx`,
    `components/marketing-header/index.tsx`, `hooks/useCurrentUser.ts`,
    `constants/index.tsx`, `vitest.config.ts`, `package.json`,
    `drizzle/0009_empty_vertigo.sql`,
    `tests/features/{users-dal,stripe-webhook-errors}.test.ts`,
    `tests/components/admin/UserRoleSection.test.tsx`,
    `tests/components/auth/{sign-in-form,sign-up-form}.test.tsx`,
    `tests/integration/{users-role,users-admin-dal,notifications-cron}.test.ts`,
    `.claude/rules/{data-layer,payments}.md`, `AGENTS.md`.
  - Bibliothèques installées : `better-auth/dist/plugins/admin/{admin.mjs,schema.mjs,schema.d.mts}`,
    `better-auth/dist/context/helpers.mjs`, `better-auth/dist/db/{with-hooks,internal-adapter}.mjs`,
    `better-auth/dist/api/routes/{callback,session}.mjs`,
    `better-auth/dist/oauth2/link-account.mjs`,
    `@better-auth/core/dist/{utils/url,error/index}.mjs`,
    `stripe/esm/resources/{Charges,Events}.d.ts`.
  - Antériorité consultée : `docs/superpowers/plans/2026-09-02-prevention-litiges-stripe.md`,
    `docs/superpowers/reviews/2026-09-02-revue-design-prevention-litiges-stripe.md`.
- **Méthode** : lecture seule, hostile. Chaque constat est prouvé contre le code
  de l'arbre courant (référence `fichier:ligne` rejouable) ; chaque suspicion a
  fait l'objet d'une tentative de réfutation, et celles qui n'ont pas survécu
  sont consignées en §4.
- **Gate** : `bun run check` (prettier + `tsc --noEmit` + `eslint --max-warnings 0`)
  lancé dans le worktree → **code de sortie 0**. La base est verte avant
  l'implémentation.

---

## 2. Constats, triés par sévérité

| #   | Sév | fichier:ligne | problème | régression ? |
| --- | --- | --- | --- | --- |
| 1 | 🔴 | `tests/features/stripe-webhook-errors.test.ts:349-379` ← plan `:1977-1988` | Le retrait de l'alerte « litige perdu » du `else if` casse la ligne `lost` de l'`it.each` existant ; aucune tâche ne met le test à jour | **OUI** |
| 2 | 🔴 | plan Task 9 (aucune étape) vs `docs/superpowers/plans/2026-09-02-…md:948` | Rien n'abonne l'endpoint Stripe (test **et** live) à `charge.refunded` → tout le lot 4 est muet en prod, invisible en dev (`stripe listen`) | NON |
| 3 | 🟠 | `app/api/stripe/webhook/route.ts:173-214` ← plan `:1955-1988`, `:2049-2064` | L'alerte « litige perdu » passe **après** l'écriture en base : invariant documenté cassé, et la doc réécrite par le plan continue d'affirmer l'inverse | **OUI** |
| 4 | 🟠 | plan `:2038-2041` (`console.warn`) | `skipped` sur `pending`/`failed` traité comme un rejeu bénin : fonds rendus, transaction non marquée, ré-octroi possible, **zéro alerte** | NON |
| 5 | 🟡 | `features/users/actions.ts:86-113` et `:391-403` | `updateUserRole` promeut un compte suspendu, `deleteMyAccount` le compte comme « autre admin » → verrouillage admin total atteignable | NON |
| 6 | 🟡 | plan `:2189` (`getByText(/par Samuel/)`) | Deux `<p>` matchent (épisode actif + historique) → `getBy*` lève « found multiple elements » | NON |
| 7 | 🟡 | plan `:329` (`await db.delete(userBans)`) | `DELETE` sans `where` dans un `beforeEach`, contraire au nettoyage par fixture du fichier et de `.claude/rules/data-layer.md:201-205` | NON |
| 8 | 🟡 | `features/users/cron.ts:29-41` vs spec « admin supprimé » | Aucun compte n'est jamais supprimé en dur → la FK `set null` ne se déclenche jamais ; `bannedByName` vaudra « Utilisateur supprimé », pas `null` | NON |
| 9 | ℹ️ | plan `:167-171`, `:1740-1757` | `transactions.refunded_at` écrit par deux chemins et lu par **aucun** (ni DAL, ni UI, ni alerte), sans backfill | NON |
| 10 | ℹ️ | plan `:2477` (`users-table.tsx:229-241`) | Ancre décalée : la cellule du badge de rôle est en `232-243` | NON |
| 11 | ℹ️ | `features/notifications/` (branche `feat/socle-courriels`) | Trois expéditeurs de courriel absents de cette branche n'auront pas le garde `banned` au merge | NON |

---

## 3. Détail par constat

### 🔴 1 — Le plan casse un test existant du webhook et prétend le contraire

**Code.** `tests/features/stripe-webhook-errors.test.ts:349-379` :

```ts
  it.each([
    ["won", "litige gagné"],
    ["lost", "litige perdu"],
    ["warning_closed", "litige clos"],
  ])(
    "charge.dispute.closed (%s) → alerte « %s » et persiste",
    async (status, message) => {
      …
      const [, error, context] = mocks.captureServerError.mock.calls[0]!   // :372
      expect((error as Error).message).toBe(message)
      expect(context).toEqual({                                            // :374
        detail: `dispute dp_1 · 9900 cad · motif fraudulent · statut ${status} · payment_intent pi_dispute`,
      })
```

Le plan, `:1977-1988`, retire l'alerte du cas `lost` du bloc
`else if (event.type === "charge.dispute.closed")` et la ré-émet plus bas
(`:1969-1974`) avec un détail enrichi :

```ts
          captureServerError("[stripe:webhook]", new Error("litige perdu"), {
            detail: `${detail} · ${describeRefund(refund)}`,
          })
```

**Pourquoi c'est une vraie faille.** Pour `status = "lost"`, `calls[0]` devient
l'alerte du remboursement. Son `message` reste « litige perdu » (l'assertion
`:373` passe), mais son `context` vaut
`{ detail: "dispute dp_1 · … · payment_intent pi_dispute · accès retiré" }`,
alors que `:374-376` exige l'égalité **stricte** avec le détail sans suffixe. Le
suffixe est garanti : le plan (`:1806-1810`) pose
`mocks.refund.mockResolvedValue({ status: "refunded", …, accessReducedOrRemoved: true })`
dans le `beforeEach`, donc `describeRefund` renvoie « accès retiré ». La Task 9
Step 4 (`plan:2069`) lance
`bun run test -- tests/features/stripe-webhook-errors.test.ts` en attendant du
vert : l'implémenteur butera dessus sans instruction, et la tentation naturelle
— desserrer l'assertion en `objectContaining` — ferait perdre la garantie de
format du détail que la campagne précédente avait verrouillée.

**Régression ?** **OUI** : un test vert aujourd'hui devient rouge, et le
comportement observable de l'alerte `lost` change (détail, ordre d'émission).

**Comment je l'ai prouvé.**
`sed -n '345,380p' tests/features/stripe-webhook-errors.test.ts` (assertion
`toEqual` exacte, lecture de `calls[0]`) confronté à
`sed -n '1955,1995p' docs/superpowers/plans/2026-09-05-bannissement.md`. Le
`beforeEach` de la Task 9 Step 1 (`plan:1804-1810`) fournit la valeur par défaut
du mock `refund` qui produit le suffixe.

**Correction suggérée.** Ajouter à la Task 9 Step 1 la mise à jour explicite de
l'`it.each` : sortir `lost` du tableau et lui donner son propre `it` attendant
`detail: "… · accès retiré"` + `expect(mocks.refund).toHaveBeenCalled()`, en
gardant `won` / `warning_closed` inchangés. Ne pas transformer le `toEqual` en
`objectContaining`.

---

### 🔴 2 — Rien n'abonne l'endpoint Stripe à `charge.refunded` : le lot 4 est mort en production

**Code.** Le plan ne comporte **aucune** étape de configuration Stripe. Sa Task 9
(`plan:1792-2075`) s'arrête au code + tests + doc, et sa Task 11 Step 4
(`plan:2495-2500`) n'ouvre que le scénario navigateur du bannissement. La spec ne
parle du Dashboard que pour **rejouer** un `charge.dispute.closed` passé.

La campagne précédente, elle, avait l'étape :

```
docs/superpowers/plans/2026-09-02-prevention-litiges-stripe.md:948
- [ ] **Step 3 : Endpoint webhook de production** — Développeurs → Webhooks →
  endpoint `/api/stripe/webhook` : `charge.dispute.updated`,
  `charge.dispute.closed`, `charge.dispute.funds_reinstated`,
  `radar.early_fraud_warning.created` cochés …
```

**Pourquoi c'est une vraie faille.** L'existence même de cette étape prouve que
l'endpoint est en mode « événements sélectionnés » : un type non coché n'est
jamais livré. Or le seul déclencheur du chemin « remboursement complet → accès
retiré » est `charge.refunded`. En développement, `stripe listen --forward-to`
(documenté dans `AGENTS.md`, § Gotchas) relaie **tous** les événements : la
vérification manuelle passera, les tests unitaires passeront (ils fabriquent
l'événement eux-mêmes), et la production ne fera rien — silencieusement. Le cas
d'usage nommé par la spec (« remboursement proactif recommandé après une alerte
`radar.early_fraud_warning.created` ») est précisément celui qui échoue.

**Régression ?** NON — fonctionnalité morte à la livraison, pas de rupture de
l'existant.

**Comment je l'ai prouvé.**
`grep -rn "charge.refunded\|enabled_events" --include=*.ts --include=*.md .`
(hors `node_modules`) : aucune occurrence de `charge.refunded` dans le code ou la
configuration du dépôt ; l'unique précédent de configuration d'endpoint est la
ligne 948 du plan de 2026-09-02. `app/api/stripe/webhook/route.ts:287-289`
confirme qu'un événement non prévu est simplement acquitté en 200.

**Correction suggérée.** Ajouter à la Task 9 une étape préalable (avant même
d'écrire le `case`) : cocher `charge.refunded` sur l'endpoint **test** et
l'endpoint **live**, et le consigner comme la campagne précédente l'a fait.
Ajouter au scénario manuel de la Task 11 : rembourser un paiement de test depuis
le Dashboard, vérifier que `stripe listen` montre `charge.refunded` en 200 et que
`user_access` disparaît.

---

### 🟠 3 — L'alerte « litige perdu » passe après l'écriture en base, contre un invariant documenté et déjà corrigé une fois

**Code.** L'état courant, `app/api/stripe/webhook/route.ts:173-214` :

```ts
      // … L'alerte part AVANT l'écriture en base : une panne Neon ne doit pas
      // la priver de son détail.                                    // :177-178
      case "charge.dispute.closed":
        …
        } else if (event.type === "charge.dispute.closed") {          // :198
          const outcome = … "litige perdu" …
          captureServerError("[stripe:webhook]", new Error(outcome), { detail })
        }
        …
        if (disputedPaymentIntent) { … recordStripeDispute … }        // :216-250
```

Le plan (`:1955-1988`) déplace l'alerte `lost` **après** le bloc
`recordStripeDispute`, et y ajoute l'appel à `refundStripeTransaction`.

**Pourquoi c'est une vraie faille.** Le chemin `lost` traverse désormais deux
écritures Neon (`recordStripeDispute`, puis la transaction de
`refundStripeTransaction`) avant d'alerter. Si l'une lève — le cas nommé par le
commentaire `:177-178` — l'exception remonte au `catch` `:291-297` et la seule
trace Sentry devient
`captureServerError("[stripe:webhook]", error, { detail: event.type })` : plus
d'id de litige, plus de montant, plus de motif, plus de `payment_intent`. C'est
exactement le constat déjà porté et corrigé lors de la campagne précédente :

```
docs/superpowers/reviews/2026-09-02-revue-design-prevention-litiges-stripe.md:184-198
« Neon indisponible. recordStripeDispute lève → … Sentry reçoit
  « charge.dispute.created » et rien d'autre … la première alerte — celle qui
  ouvre la fenêtre de réponse — est aveugle. »
```

Aggravant : la Task 9 Step 3 (`plan:2049-2064`) réécrit
`.claude/rules/payments.md` en **conservant** la phrase « Le webhook alerte
Sentry AVANT d'écrire en base (une panne Neon ne doit pas priver l'alerte de son
détail) ». La documentation devient fausse pour le cas le plus coûteux.

Le fait que Stripe réessaie n'est pas une réponse suffisante : le retry peut
n'aboutir qu'après plusieurs minutes ou heures, et l'alerte `lost` est le signal
qui ouvre l'action humaine (bannissement, comptabilité, réponse au client).

**Régression ?** **OUI** — comportement volontairement établi le 2026-09-02,
défait ici.

**Comment je l'ai prouvé.** Lecture de `app/api/stripe/webhook/route.ts:173-297`
et de `docs/superpowers/reviews/2026-09-02-revue-design-prevention-litiges-stripe.md:184-198`,
confrontées à `sed -n '1950,2065p' docs/superpowers/plans/2026-09-05-bannissement.md`.

**Correction suggérée.** Garder l'alerte inconditionnelle « litige perdu » **là
où elle est** (avant toute écriture), et émettre une **seconde** alerte, de
message distinct, pour l'issue du retrait d'accès (par ex.
`new Error("litige perdu · accès")` avec `detail: describeRefund(refund)`).
Bénéfice collatéral : le constat 1 disparaît, l'`it.each` existant reste vrai tel
quel.

---

### 🟠 4 — Un remboursement sur une transaction `pending` est avalé en silence, et l'accès peut être octroyé après coup

**Code.** Plan `:2036-2041` :

```ts
        } else {
          console.warn(`[stripe webhook] remboursement ignoré · ${detail} · ${describeRefund(refund)}`)
        }
```

`refundStripeTransaction` (plan `:1668-1704`) renvoie
`{ status: "skipped", currentStatus }` pour **tout** statut ≠ `completed` :
`refunded` (rejeu Stripe, bénin), mais aussi `pending` et `failed`.

**Pourquoi c'est une vraie faille.** Le déclencheur concret : un paiement différé
(virement) laisse la transaction en `pending` jusqu'au
`checkout.session.async_payment_succeeded`
(`app/api/stripe/webhook/route.ts:110-116`), et l'ordre de livraison des
événements Stripe n'est pas garanti — `.claude/rules/payments.md:44-51` documente
déjà qu'un `charge.dispute.created` peut précéder le `checkout.session.completed`
(carte de test 0259) et qu'un paiement différé peut être contesté avant
confirmation. Si un `charge.refunded` (ou un `charge.dispute.closed / lost` sur un
différé) arrive alors que la transaction est encore `pending` :

1. `refundStripeTransaction` verrouille `user`, l'`UPDATE … WHERE status = 'completed'`
   ne touche rien → `skipped: "pending"` ;
2. `console.warn` — aucune trace Sentry, aucune alerte, rien au-delà de la
   rétention des logs Vercel (~1 h) ;
3. le `checkout.session.completed` arrive plus tard, `completeStripeTransaction`
   passe la transaction en `completed` et **octroie l'accès** alors que les fonds
   sont partis.

Le verrou `user` du plan protège correctement la course *simultanée* (voir §4,
faux positif « course refund/complete ») ; il ne protège rien contre la séquence
*décalée*. Traiter `pending` comme un rejeu efface le seul signal qui permettrait
à un humain de rattraper.

**Régression ?** NON — trou d'un chemin neuf.

**Comment je l'ai prouvé.** Lecture de `plan:1668-1704` (les trois retours) et
`plan:2016-2044` (le triage `refunded` / `not_found` / `else`) ; comparaison avec
`app/api/stripe/webhook/route.ts:110-171` (les transactions restent `pending`
jusqu'au second événement) et `.claude/rules/payments.md:44-51`.

**Correction suggérée.** Distinguer les deux cas dans le webhook **et** dans la
branche `lost` :

```ts
        } else if (refund.currentStatus === "refunded") {
          console.warn(`[stripe webhook] rejeu · ${detail}`)
        } else {
          captureServerError(
            "[stripe:webhook]",
            new Error("retour de fonds sur une transaction non complétée"),
            { detail: `${detail} · statut ${refund.currentStatus}` },
          )
        }
```

Et ajouter au test de la Task 9 un cas `skipped / pending → alerte, 200` (le plan
ne teste aujourd'hui que `skipped / refunded`, `plan:1873-1879`).

---

### 🟡 5 — Un compte suspendu peut devenir administrateur, et compte comme « autre admin » à la suppression

**Code.** `features/users/actions.ts:86-113` (`updateUserRole`) sélectionne
`{ id, role, deletedAt }` — jamais `banned` — et promeut sans autre condition.
`features/users/actions.ts:391-403` (`deleteMyAccount`) :

```ts
      const admins = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "admin"), isNull(user.deletedAt)))   // :396
        .orderBy(user.id)
        .for("update")
      const hasOtherAdmin = admins.some((a) => a.id !== authSession.user.id)
```

Le plan (`:566-576`) réécrit le corps transactionnel d'`updateUserRole` via
`lockCallerAndTarget`, qui lit désormais `banned`… mais ne s'en sert pas.

**Pourquoi c'est une vraie faille.** La spec écrit : « Un admin ne se bannit pas
et ne bannit pas un admin. Cela règle sans compteur le problème “dernier admin
banni” ». La garde de `banUser` est bien celle-là et elle tient. Mais l'autre
porte reste ouverte : admin A suspend B, puis promeut B administrateur (aucune
règle ne l'interdit) ; B est alors admin **et** suspendu, donc incapable de créer
une session. Si A supprime ensuite son compte, `deleteMyAccount` voit B dans
`admins` (non supprimé, rôle admin) → `hasOtherAdmin = true` → suppression
autorisée. Il ne reste plus aucun administrateur capable de se connecter, et
`unbanUser` exige `requireRole(["admin"])` : la seule sortie est un `UPDATE`
manuel en base.

C'est une chaîne de trois gestes admin volontaires, d'où le 🟡 — mais le coût de
la garde est d'un prédicat, et l'invariant que la spec revendique n'est vrai que
dans sa formulation littérale.

**Régression ?** NON — l'état « admin suspendu » n'existe pas aujourd'hui.

**Comment je l'ai prouvé.** `cat -n features/users/actions.ts` : ni
`updateUserRole` (l.86-113) ni le `where` de `deleteMyAccount` (l.396) ne
mentionnent `banned` ; `plan:511-536` (`lockCallerAndTarget`) lit `banned` sans
l'utiliser dans le chemin `updateUserRole` (`plan:566-576`) ; `plan:660-680`
(`unbanUser`) commence par `requireRole(["admin"])`.

**Correction suggérée.** Le moins cher : ajouter `eq(user.banned, false)` au
`where` de `deleteMyAccount:396` (un admin suspendu ne compte pas comme admin
utilisable). Optionnellement, refuser la promotion d'un compte suspendu dans
`updateUserRole` (« Levez d'abord la suspension de ce compte. ») — le helper
remonte déjà `banned`, c'est trois lignes.

---

### 🟡 6 — Le test `UserBanSection` « compte suspendu » ne peut pas passer

**Code.** Plan `:2178-2200` :

```tsx
    render(
      <UserBanSection user={{ ...baseUser, banned: true }}
        bans={[activeBan, pastBan]} currentUserId="viewer" />,
    )
    …
    expect(screen.getByText(/par Samuel/)).toBeInTheDocument()   // :2189
```

avec `activeBan.bannedByName = "Samuel"` (`plan:2131`) **et**
`pastBan.bannedByName = "Samuel"` (`plan:2141`).

Le composant (`plan:2230-2248` et `:2285-2300`) rend deux `<p>` :

- épisode actif → nœuds texte directs « Depuis le … par **Samuel** » ;
- épisode passé (`BanEpisode`) → « Du … par **Samuel** au … par Autre ».

**Pourquoi c'est une vraie faille.** Le matcher par défaut de Testing Library
(`getNodeText`) concatène les nœuds texte **enfants directs** d'un élément — y
compris ceux d'un fragment inline, qui sont des enfants directs du `<p>` dans le
DOM. Les deux `<p>` correspondent donc à `/par Samuel/`, et `getByText` lève
« Found multiple elements ». Le test échoue alors que la Task 10 Step 4 attend du
vert.

**Régression ?** NON.

**Comment je l'ai prouvé.** Lecture des fixtures (`plan:2126-2148`) et du JSX du
composant ; le fichier voisin
`tests/components/admin/UserRoleSection.test.tsx:72-74` contourne déjà ce piège
en interrogeant `getByRole("alertdialog")` plutôt qu'un texte partagé.

**Correction suggérée.** Distinguer les fixtures
(`pastBan.bannedByName = "Ancien admin"`) ou viser le conteneur :
`within(screen.getByTestId("ban-active")).getByText(/par Samuel/)`, après avoir
ajouté un `data-testid` au bloc courant.

---

### 🟡 7 — `db.delete(userBans)` sans `where` dans un `beforeEach` de test d'intégration

**Code.** Plan `:329` (`tests/integration/users-ban.test.ts`) :

```ts
beforeEach(async () => {
  vi.mocked(captureServerError).mockClear()
  await db.delete(userBans)                                     // :329
  await db.delete(sessionTable).where(eq(sessionTable.userId, targetId))
```

**Pourquoi c'est une vraie faille.** Toutes les autres suppressions du même
fichier — et de `tests/integration/notifications-cron.test.ts:94-107` — sont
bornées par un `where` sur les fixtures. `.claude/rules/data-layer.md:201-205`
codifie ce nettoyage ciblé. Un `DELETE` de table entière est sans effet visible
tant que `bun run test:integration` crée une branche Neon jetable, mais il rend
le fichier dangereux dès qu'il est lancé autrement
(`test:integration:keep`, exécution ciblée sur une branche conservée, ou un
`DATABASE_URL` mal pointé). C'est le genre de ligne qu'on ne remarque plus une
fois mergée.

**Régression ?** NON.

**Comment je l'ai prouvé.** `sed -n '320,340p'` du plan, comparé au style du reste
du fichier (`plan:290-318`, tous les `delete` portent un `where`) et à
`.claude/rules/data-layer.md:200-206`.

**Correction suggérée.**
`await db.delete(userBans).where(inArray(userBans.userId, [adminId, otherAdminId, targetId, bystanderId]))`
— `inArray` est déjà importé dans le fichier de test.

---

### 🟡 8 — La branche « admin supprimé » du journal n'existe pas en production, et le test la simule à la main

**Code.** `features/users/cron.ts:28-41` — l'anonymisation est un **UPDATE**, pas
un `DELETE` :

```ts
        await tx.update(user).set({
            name: "Utilisateur supprimé",
            email: `deleted-${id}@deleted.invalid`,
            …
            anonymizedAt: new Date(),
          }).where(eq(user.id, id))
        await tx.delete(account).where(eq(account.userId, id))     // :40
```

Le plan pose `bannedBy`/`liftedBy` en `onDelete: "set null"` (`plan:104-112`), la
spec en déduit « Un `banned_by` nul se lit “admin supprimé” dans l'UI », le
composant affiche `ban.bannedByName ?? "un admin supprimé"` (`plan:2233`, `:2291`)
et le test force la valeur :

```ts
    await db.update(userBans).set({ bannedBy: null }).where(eq(userBans.userId, targetId))
    expect((await getUserBans(targetId))[0]?.bannedByName).toBeNull()   // plan:558-560
```

**Pourquoi c'est une vraie faille.** Aucun chemin du produit ne supprime une ligne
`user` : suppression douce (`deletedAt`) puis anonymisation par UPDATE. La FK
`set null` ne se déclenchera donc jamais, et `getUserBans` joindra une ligne
`user` bien vivante dont le `name` vaut « Utilisateur supprimé ». L'admin lira
« Suspendu … par **Utilisateur supprimé** » — jamais le repli prévu. Le test, en
écrivant `null` lui-même, ne prouve rien du comportement réel et donne une fausse
assurance. Le choix `set null` reste correct (cohérent avec
`transactions.recordedBy`, `db/schema/payments.ts:97-99`) : c'est la conclusion
tirée dans la spec qui est fausse.

**Régression ?** NON.

**Comment je l'ai prouvé.** `cat -n features/users/cron.ts` (UPDATE + delete des
seules lignes `account`) ; `grep -rn "delete(user)" features lib app` ne renvoie
que des suppressions de fixtures dans `tests/`.

**Correction suggérée.** Soit remplacer le repli par « un compte supprimé »
(exact dans les deux cas), soit — mieux — afficher `bannedByName` tel quel, retirer
la branche `null` de l'UI et du test, et garder `set null` comme simple filet FK.
Remplacer le test « auteur supprimé » par un test « auteur anonymisé » qui rejoue
`anonymizeExpiredDeletedAccounts`, seul scénario atteignable.

---

### ℹ️ 9 — `refunded_at` : écrit deux fois, lu nulle part

Colonne ajoutée (`plan:167-171`), écrite par `refundStripeTransaction`
(`plan:1684`) et `updateManualTransaction` (`plan:1740-1757`), testée
(`plan:1836`, `:1897`). Aucun consommateur : `PanelTransaction`
(`features/users/dal.ts:592-608`) ne la sélectionne pas, `getAllTransactions` non
plus, aucune alerte ne l'utilise, et les lignes déjà `refunded` ne sont pas
backfillées. C'est défendable comme trace d'audit, mais ni la spec ni le plan
n'énoncent le consommateur, et `AGENTS.md` (§ Façon de travailler, YAGNI) invite à
l'inverse. Si la colonne reste, dire **pourquoi** dans la spec (corrélation avec
le journal Stripe, comme `confirmation_email_message_id` l'a fait pour SES) ;
sinon la retirer du lot 1 et la rouvrir en issue.

---

### ℹ️ 10 — Ancre de ligne décalée sur `users-table.tsx`

Le plan annonce
`app/(admin)/admin/utilisateurs/_components/users-table.tsx:229-241` (`plan:38`,
`:2477`). La cellule du badge de rôle occupe en réalité `232-243`
(`sed -n '229,245p'`). Le bloc est identifiable sans ambiguïté, mais l'ancre
chiffrée est fausse — à ne pas suivre aveuglément.

---

### ℹ️ 11 — Le garde `banned` des courriels sera incomplet au merge

La Task 4 ajoute `eq(user.banned, false)` aux **deux** `where` de
`features/notifications/cron.ts` (`:48` et `:117`) — exact et complet **sur cette
branche**. Mais la branche `feat/socle-courriels` (worktree principal, commits
`379cc4b`, `49031b5`, `f4346bd`) introduit trois expéditeurs supplémentaires —
courriel de bienvenue, relance d'inactivité, rappel de panier abandonné — dont
aucun ne connaîtra ce garde. La règle « un compte suspendu ne reçoit aucun
courriel de la plateforme » (spec, Lot 2) sera fausse dès la fusion des deux
branches, sans qu'aucun test ne l'attrape. À noter comme point de vigilance de
merge, et idéalement à formuler dans `.claude/rules/data-layer.md` comme une
règle portant sur **tous** les expéditeurs, pas comme deux `where` ponctuels.

---

## 4. Faux positifs écartés

| Suspicion | Verdict et preuve |
| --- | --- |
| Le hook `session.create.before` du plugin admin est neutralisé par `disabledPaths` → tout le lot 3 repose sur du vide | **Écarté.** `admin.mjs:25-50` pose le hook dans `init()`, pas dans les `endpoints`. `context/helpers.mjs:14-31` empile les `databaseHooks` de chaque plugin dans `dbHooks`, puis ceux de l'utilisateur (`:43-46`) ; `db/with-hooks.mjs:8-21` les exécute **tous**, en ordre, et propage l'exception. `disabledPaths` ne touche que le routeur. |
| Le hook du plugin et le `databaseHooks.session.create.before` de l'app s'écrasent (perte de la grâce de 30 j) | **Écarté.** Même preuve : ce sont deux entrées d'une liste, pas un `defu` de l'objet `databaseHooks` — `helpers.mjs:22-26` extrait `databaseHooks` **avant** le `defu(options, restOpts)` de `:28`. |
| `errorCallbackURL: "/connexion"` (URL relative) rejetée par Better Auth | **Écarté.** `@better-auth/core/dist/utils/url.mjs:40-49` : `appendQueryParams` accepte explicitement une URL « root-relative » et renvoie `/connexion?error=…`. `oauth2/state.mjs:27` lit `errorCallbackURL` du corps, `:62` ne pose le défaut que s'il est absent. |
| Le code d'erreur OAuth n'est pas exactement `BANNED_USER` | **Écarté.** `admin.mjs:44-48` lève `APIError.from("FORBIDDEN", { code: "BANNED_USER" })` ; `@better-auth/core/error/index.mjs:19-24` place `code` dans `body` ; `api/routes/callback.mjs:241-243` fait `redirectOnError(e.body.code, e.body.message)`. `oauth2/link-account.mjs:268` n'entoure pas `createSession` d'un `catch`. |
| `banned` absent du type `auth.$Infer.Session` → le repli par cast du plan est nécessaire | **Écarté.** `plugins/admin/schema.d.mts` déclare `banned: { type: "boolean"; required: false }`, fusionné par `mergeSchema` (fin d'`admin.mjs`). `session.user.banned` typera `boolean \| null \| undefined`. Le cast (`plan:965`) est superflu — inoffensif, mais à ne pas laisser en dette. |
| Le motif interne (`ban_reason`) fuit vers le client | **Écarté** sur trois chemins : `lib/session-user.ts:18-23` projette 4 champs explicitement ; le callback OAuth met `bannedUserMessage` (statique) dans `error_description`, jamais `ban_reason` ; et `banUser` supprime les sessions dans la même transaction, donc `/api/auth/get-session` ne renvoie plus rien à l'intéressé. |
| Cookie résiduel + `proxy.ts:62-64` → boucle `/` → `/tableau-de-bord` → `/connexion` | **Écarté** (transitoire). `better-auth/dist/api/routes/session.mjs:146-149` appelle `deleteSessionCookie` quand la session est introuvable ; `components/marketing-header/index.tsx:38` (`useCurrentUser` → `authClient.useSession`) déclenche ce `get-session` dès que `/connexion` monte, via `MarketingShell` (`app/(auth)/layout.tsx:8`). Le cookie mort disparaît au premier atterrissage. |
| L'ajout de code non testé fait passer la couverture sous 80 % → CI rouge | **Écarté.** `vitest.config.ts:39-45` n'inclut que `lib/**`, `hooks/**`, `components/**`, `schemas/**`, `email/**`. `features/**` et `app/**` sont hors périmètre ; `lib/dal.ts` est même explicitement exclu (`:67`). `UserBanSection`, la page `/compte-suspendu` et `OAuthErrorHandler` vivent sous `app/**`. Seul `lib/auth-errors.ts` entre dans le calcul, et il est testé. |
| L'ajout de `banned` aux `select` casse `tests/features/users-dal.test.ts` (question 10) | **Écarté.** Le `fakeDb` (`:31-51`) ignore la forme du `select` et renvoie `mocks.rows.current[table]` ; la fixture `detailRow` (`:138-147`) n'est jamais comparée en `toEqual` complet (`:151-203`). Le mock de `@/db/schema` (`:66-73`) n'expose pas `userBans`, mais `getUserBans` ne l'évalue qu'à l'appel — jamais fait dans ce fichier. |
| `tests/components/auth/sign-up-form.test.tsx` casse à l'ajout d'`errorCallbackURL` | **Écarté.** Le mock `signInSocial` est déclaré (`:8`) et branché (`:15`), jamais interrogé sur ses arguments. La contingence du plan (`:1179`) est inutile. |
| `Textarea` ne transmet pas `data-testid` | **Écarté.** `components/ui/textarea.tsx:12` : `{...props}`. La contingence du plan (`:2400`) est inutile. |
| `db/schema/index.ts` doit être modifié pour exporter `userBans` | **Écarté.** `db/schema/index.ts:1` : `export * from "./auth"`. |
| drizzle-kit ne génère pas l'index unique partiel (question 8) | **Écarté.** Précédent identique : `db/schema/payments.ts:161-163` a produit `drizzle/0009_empty_vertigo.sql:6` → `CREATE INDEX "user_access_expiry_reminder_pending_idx" ON "user_access" USING btree ("expires_at") WHERE "user_access"."expiry_reminder_sent_at" is null;`. La chaîne attendue par le plan (`:151`) est de cette forme exacte. |
| Interblocage entre les nouveaux verrous et l'existant (question 4) | **Écarté.** Tous les `for("update")` du dépôt portent sur `user` : `payments/stripe.ts:110`, `payments/lib.ts:63` et `:206`, `payments/actions.ts:227`, `users/actions.ts:94` et `:398`. Aucune ligne `transactions`/`user_access` n'est verrouillée explicitement → aucun cycle. Les deux verrous multi-lignes trient par `user.id`. |
| Course `refundStripeTransaction` / `completeStripeTransaction` (question 5, volet simultané) | **Écarté.** Le `SELECT` initial ne sert qu'à trouver l'id et le `userId` ; l'autorité est l'`UPDATE … WHERE id = ? AND status = 'completed'`, exécuté **après** le verrou `user`. En READ COMMITTED cet `UPDATE` relit la version committée la plus récente : si la complétion a validé pendant l'attente du verrou, le remboursement s'applique. Reste le volet séquentiel → constat 4. |
| Interaction ban / suppression douce (question 9) | **Écarté.** Le hook du plugin (source `plugin:admin`) est empilé **avant** celui de l'app (`helpers.mjs:43-46`) et lève : le `session.create.after` de `lib/auth.ts:55-67`, qui efface `deletedAt`, n'est jamais atteint pour un banni. `banUser` refuse une cible `deletedAt` non nul → les deux ensembles sont disjoints. `anonymizeExpiredDeletedAccounts` ne lit que `deletedAt`. |
| Le plan oublie `user-table-row.tsx`, que la spec cite | **Écarté.** `grep -rn "user-table-row\|UserTableRow" app components` : aucun import. C'est du code mort — la spec est en retard, pas le plan. |
| Les routes doivent passer par `constants/index.tsx` (AGENTS.md) | **Écarté.** `constants/index.tsx` ne porte pas de table de routes d'auth (`grep -n "connexion" constants/index.tsx` : rien) ; `/connexion` est en dur dans `lib/auth-guards.ts:8`. Le plan est cohérent avec l'existant. |
| L'ancre « fin de la section PII » de `.claude/rules/data-layer.md` n'existe pas | **Écarté.** La section commence en `:208` et va jusqu'à la fin du fichier (`:233`) ; l'ajout s'applique. (Sur le fond, la doctrine « suspendu = pas de session » relève plus du DAL que de la PII — cosmétique.) |
| `lib/session-user.ts` cassé par le `null` de `getCurrentSession` | **Écarté.** `lib/session-user.ts:3` fait déjà `NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>` ; le type de retour reste `… \| null`. |
| `Stripe.Charge.refunded` signifie « au moins un remboursement » (question 6) | **Écarté.** `stripe/esm/resources/Charges.d.ts:188-190` : « Whether the charge has been fully refunded. If the charge is only partially refunded, this attribute will still be false. » Le triage complet/partiel du plan est juste ; `amount_refunded`/`amount` existent bien (`:69-71`). |
| Un litige perdu émet aussi un `charge.refunded` (double traitement) | **Écarté** comme risque : rien dans les types installés ne l'atteste, et le cas échéant le second passage retombe en `skipped: "refunded"` — bruit nul. Il ne deviendrait bruyant qu'avec la correction du constat 4, dont l'alerte ne se déclenche que sur `pending`/`failed`. |
| `charge.refunded` absent de l'union `Stripe.Event["type"]` → `tsc` refuse le `case` | **Écarté.** `stripe/esm/resources/Events.d.ts:78` liste `'charge.refunded'` ; `:620-629` déclare `ChargeRefundedEvent` avec `data.object: Charge`. Le `as Stripe.Charge` du plan est redondant (union discriminée) mais conforme au style du fichier. |
| Le refactor `lockCallerAndTarget` change le comportement d'`updateUserRole` (question 7) | **Écarté.** Ordre des contrôles identique (appelant puis cible), mêmes messages, même `orderBy(user.id).for("update")`, une seule colonne de plus au `select`. `tests/integration/users-role.test.ts` couvre les cinq messages, l'idempotence sans écriture (`:99-108`, via `$onUpdate` sur `updatedAt`) et la course croisée (`:164-192`). |
| Les imports du nouveau bloc de `notifications-cron.test.ts` manquent | **Écarté.** `tests/integration/notifications-cron.test.ts:5-19` importe déjà `products`, `transactions`, `user`, `userAccess`, `examParticipations`, `exams`, `grantManualAccess`, `createId`. |

---

## 5. Réponses aux questions ouvertes

**1. `getCurrentSession` → `null` pour un banni : bon choix ? cookie résiduel ? typage ?**

Oui, et c'est le bon point d'étranglement : `grep -rn "auth.api.getSession"` ne
renvoie qu'une occurrence dans tout le dépôt (`lib/dal.ts:8`). Tous les
consommateurs serveur passent par là — `requireSession`/`requireRole`
(`lib/auth-guards.ts:6-18`), `getSessionForRoute` (`:21-23`, que
`app/api/e2e/route.ts` n'utilise même pas, il s'authentifie par secret),
`hasAccess` (`features/payments/dal.ts:78-97`), `getAccessStatus`, les DAL
`exams`/`training`/`users`, et le prop `isAuthenticated` de `/tarifs`
(`app/(marketing)/tarifs/page.tsx:38`). Je n'ai trouvé **aucun** consommateur
pour qui « pas de session » soit pire que « session bannie » : partout, l'absence
de session est le chemin déjà éprouvé (déconnexion, redirection, `false`, `null`).

Le cookie résiduel ne produit pas de boucle durable : `proxy.ts:59-69` laisse
passer, le layout redirige vers `/connexion`, et le `MarketingHeader` client
déclenche le `deleteSessionCookie` de
`better-auth/dist/api/routes/session.mjs:146-149`. Un seul aller-retour suffit.
Le seul état gênant est **transitoire** et n'existe que si `user.banned` est posé
sans supprimer les sessions (édition SQL manuelle, ou un futur chemin qui
contournerait `banUser`) : la session Better Auth reste valide, le client se croit
connecté (en-tête avec avatar), le serveur dit « déconnecté », et `/` rebondit
vers `/tableau-de-bord` puis `/connexion` — donc le bouton « Retour à l'accueil »
de `/compte-suspendu` n'atteint pas l'accueil. À accepter, mais à écrire comme
invariant : **toute écriture de `user.banned = true` doit supprimer les sessions
dans la même transaction.**

Le champ est bien typé
(`plugins/admin/schema.d.mts` : `banned: { type: "boolean"; required: false }`),
donc le repli par cast prévu à la Task 3 Step 2 est **inutile**. Il est aussi
malsain : un cast masquerait le jour où le champ disparaîtrait vraiment du type
(montée de version). Écrire `session?.user.banned` directement, et si `tsc`
proteste, s'arrêter pour comprendre plutôt que caster.

**2. Le hook `session.create.before` joue-t-il malgré `disabledPaths` ?**

Oui, sans ambiguïté. `admin.mjs:25-50` : le hook est retourné par `init()`, pas
par les `endpoints`. `context/helpers.mjs:14-31` empile les `databaseHooks` de
chaque plugin dans une **liste** (`dbHooks`), puis y ajoute ceux de l'utilisateur
(`:43-46`), et `db/with-hooks.mjs:8-21` boucle sur toute la liste en propageant
l'exception. `disabledPaths` (`lib/auth.ts:115-131`, 15 chemins — décompte
vérifié) n'agit que sur le routeur HTTP. Le lot 3 ne repose pas sur du vide.

**3. Connexion Google d'un banni : `?error=BANNED_USER` sur une URL relative ?**

Oui, avec le code et la casse exacts. Chaîne complète vérifiée :
`admin.mjs:44-48` (`APIError.from("FORBIDDEN", { code: "BANNED_USER" })`) →
`@better-auth/core/error/index.mjs:19-24` (`code` dans `body`) →
`oauth2/link-account.mjs:268` (`createSession` non entouré d'un `catch`) →
`api/routes/callback.mjs:241-243`
(`if (isAPIError(e) && e.body?.code) redirectOnError(e.body.code, e.body.message)`)
→ `callback.mjs:80-86` (`errorURL ?? defaultErrorURL`, `new URLSearchParams({ error })`).
L'URL relative est acceptée : `@better-auth/core/utils/url.mjs:40-49` traite
explicitement le cas « root-relative » et renvoie
`/connexion?error=BANNED_USER&error_description=…`. Deux remarques : (a)
`error_description` portera `bannedUserMessage`, donc l'ajout de
`bannedUserMessage: "Ce compte est suspendu."` (Task 5) n'est pas cosmétique — il
évite un message anglais dans l'URL ; (b) le `OAuthErrorHandler` fait
`router.replace("/compte-suspendu")` avant tout rendu, donc l'utilisateur ne voit
pas ce paramètre.

**4. Ordre des verrous : un chemin prend-il `transactions` ou `user_access` avant `user` ?**

Non. `grep -n 'for("update")'` sur `features/**` ne renvoie que six occurrences,
toutes sur `user` : `payments/stripe.ts:110`, `payments/lib.ts:63`
(`grantManualAccess`) et `:206` (`recomputeAccess`), `payments/actions.ts:227`
(`updateManualTransaction`), `users/actions.ts:94` (`updateUserRole`) et `:398`
(`deleteMyAccount`). `deleteManualTransaction` (`payments/actions.ts:277-299`)
passe par `recomputeAccess`, donc verrouille `user` en premier lui aussi.
`recordStripeDispute` (`payments/stripe.ts:352-388`) fait un `UPDATE` autonome
hors transaction : il ne détient rien en attendant autre chose. Les deux verrous
multi-lignes (`lockCallerAndTarget` et `deleteMyAccount`) trient par `user.id`.
Aucun cycle n'est constructible. Le double verrou du plan (le `for("update")`
explicite de `refundStripeTransaction` puis celui de `recomputeAccess`) est
redondant mais nécessaire : c'est lui qui garantit l'ordre user → transactions.

**5. Fenêtre entre le premier `SELECT` et le `FOR UPDATE`.**

Le volet **simultané** est déjà couvert (§4). Le volet **séquentiel** ne l'est
pas : c'est le constat 4. Un retour de fonds sur une transaction encore `pending`
est ignoré en `console.warn`, puis le `checkout.session.completed` arrive et
octroie l'accès. Le cas est réel — `.claude/rules/payments.md:44-51` documente
qu'un litige peut précéder le fulfillment (carte 0259) et qu'un paiement différé
peut être contesté avant confirmation. Ma réponse : **ne pas** verrouiller avant
de lire (le pending n'est pas encore complété au moment de la lecture, ça n'y
changerait rien), mais **alerter** sur tout `skipped` dont le statut n'est pas
`refunded`. Le rattrapage reste humain — acceptable pour un événement de cette
rareté, à condition qu'il soit visible.

**6. Sémantique de `charge.refunded`.**

(a) `Charge.refunded` = **intégralement** remboursé
(`stripe/esm/resources/Charges.d.ts:188-190`, cité en §4) : le triage
complet/partiel du plan est juste, et `amount_refunded`/`amount` (`:69-71`)
existent pour le détail de l'alerte. (b) Un litige perdu n'émet pas de refund
dans le modèle carte (les fonds partent par un `adjustment`, pas un `Refund`) ; si
un moyen de paiement en produisait un, le second passage retomberait en
`skipped: "refunded"` — bruit nul. (c) **L'abonnement de l'endpoint n'est nulle
part** : c'est le constat 2, et c'est le plus grave des trois volets — sans lui,
le lot 4 ne s'exécute jamais en production et aucun test ne peut le révéler.

**7. Refactor d'`updateUserRole` : strictement identique ?**

Oui — preuve détaillée en §4. `tests/integration/users-role.test.ts` couvre les
cinq messages, l'idempotence sans écriture et la course croisée. Une réserve de
méthode, pas une correction : ce refactor n'est demandé par aucune ligne de la
spec. Il touche un chemin sensible qui fonctionne, pour économiser une vingtaine
de lignes. Si le temps manque, c'est la première chose à couper. S'il est
conservé, ne pas perdre les commentaires `features/users/actions.ts:57-63` et
`:87-88`, que le plan ne reprend pas.

**8. Index unique partiel : drizzle-kit le génère-t-il ?**

Oui — voir §4 : `db/schema/payments.ts:161-163` a produit
`drizzle/0009_empty_vertigo.sql:6` avec exactement la forme
`… USING btree ("expires_at") WHERE "user_access"."expiry_reminder_sent_at" is null;`.
La chaîne que le plan demande de vérifier (`:151`) est cohérente avec ce
précédent. Vérifier tout de même que la migration générée porte bien le numéro
**0017** : la dernière en place est `0016_account_issuer.sql`.

**9. Interactions avec la suppression douce.**

Aucune collision atteignable — voir §4. Les deux états sont disjoints par
construction : `banUser` refuse une cible `deletedAt` non nul, et un banni ne peut
pas créer de session, donc ni supprimer son compte ni déclencher le
`session.create.after` qui efface `deletedAt`. Le seul angle mort est celui du
constat 8 : l'anonymisation étant un UPDATE, elle laisse le journal des bans
pointer vers un compte « Utilisateur supprimé » plutôt que vers `null`.

**10. `tests/features/users-dal.test.ts` cassé par l'ajout de `banned` ?**

Non — preuve en §4. Le `fakeDb` ignore la forme du `select`, et aucune assertion
ne compare `AdminUserDetail` en entier. Attention en revanche à ne pas ajouter
plus tard un test qui appellerait `getUserBans` dans ce fichier : le mock de
`@/db/schema` (`:66-73`) n'expose pas `userBans` et l'appel échouerait.

**11. Quelque chose de « hors périmètre » qui ne l'est pas ?**

Trois vérifications, deux acquittements et un désaccord.

- *Exclusion des bannis des sélecteurs admin* : différable, la spec a raison —
  `grantManualAccess` sur un banni écrit `user_access` mais rien n'est
  consommable sans session, et `hasAccess` sans `userId`
  (`features/payments/dal.ts:81-86`) renvoie `false` faute de session.
- *Courriel au banni, ban temporaire, filtre de liste, re-crédit Stripe* :
  différables sans état incohérent.
- **Désaccord** : ce qui n'est pas différable, c'est le **garde manquant sur la
  promotion et le comptage d'admins** (constat 5). La spec range « dernier admin
  banni » du côté des problèmes résolus ; il ne l'est que pour le geste
  `banUser`. Un prédicat dans `deleteMyAccount:396` referme la porte, et c'est
  moins cher maintenant qu'après.

Ajout hors liste : l'**abonnement Stripe à `charge.refunded`** (constat 2) n'est
pas différable non plus — c'est le déclencheur du lot que la campagne existe pour
livrer.

---

## 6. Verdict

**Le plan est-il sûr et complet pour être implémenté tel quel ? → NON.**

La conception d'ensemble est solide : le point d'étranglement `getCurrentSession`
est le bon (une seule occurrence d'`auth.api.getSession` dans tout le dépôt), le
verrou ordonné par `user.id` ne crée aucun cycle, le ban comme *gel* réversible
est le bon modèle, et les ancres, signatures et types du plan
(`RefundStripeResult`, `UserBanView`, `AdminUserDetail.banned`,
`AccountActionResult`, props de `UserBanSection`, `data-testid`) concordent d'une
tâche à l'autre et correspondent au code réel. Sur l'ensemble des modifications
confrontées ligne à ligne, une seule ancre est fausse (constat 10) et deux
contingences prévues sont inutiles (`Textarea`, cast de `banned`).

Trois choses bloquent l'implémentation telle quelle :

1. **Le lot 4 ne s'exécutera jamais en production** faute d'abonnement Stripe à
   `charge.refunded` (constat 2) — et rien dans la chaîne de tests ne peut le
   révéler.
2. **Un test existant du webhook devient rouge** sans que le plan le dise
   (constat 1), à l'étape même où il annonce du vert.
3. **L'alerte la plus importante du domaine paiements perd sa garantie
   d'émission** (constat 3), en défaisant une correction délibérée du 2026-09-02
   tout en réécrivant la doctrine qui l'énonce.

Le constat 4 (remboursement avalé sur une transaction `pending`) n'est pas
bloquant au sens strict, mais c'est le seul endroit du lot 4 où de l'argent peut
partir sans que personne ne le sache — à traiter dans la même passe.

### Corrections priorisées

**À corriger avant de coder**

| # | Correction |
| --- | --- |
| 2 | Ajouter à la Task 9 une étape « cocher `charge.refunded` sur l'endpoint webhook **test** et **live** », et l'inscrire au scénario manuel de la Task 11 (rembourser depuis le Dashboard, vérifier le 200 et la disparition de `user_access`). |
| 3 | Laisser l'alerte « litige perdu » **avant** toute écriture ; émettre une alerte distincte pour l'issue du retrait d'accès. Corriger en conséquence la formulation de `.claude/rules/payments.md` réécrite en Task 9 Step 3. |
| 1 | Écrire explicitement, en Task 9 Step 1, la mise à jour de l'`it.each` `charge.dispute.closed` (sortir `lost`, lui donner son propre `it`). Devient sans objet si la correction 3 est retenue — vérifier laquelle s'applique. |
| 4 | Distinguer `skipped: "refunded"` (rejeu, `console.warn`) de `skipped: "pending" \| "failed"` (alerte Sentry), dans les deux branches `charge.refunded` et `dispute.closed / lost` ; ajouter le test correspondant. |
| 5 | Ajouter `eq(user.banned, false)` au `where` de `deleteMyAccount` (`features/users/actions.ts:396`) — une ligne, et l'invariant « il reste toujours un admin utilisable » redevient vrai. |

**À surveiller pendant l'implémentation**

| # | Point |
| --- | --- |
| 6 | Le test `UserBanSection` « compte suspendu » lèvera sur `getByText(/par Samuel/)` : distinguer les fixtures ou viser un conteneur. |
| 7 | Remplacer `db.delete(userBans)` par un `delete … where(inArray(...))` borné aux fixtures. |
| — | Ne PAS introduire le cast `(session?.user as { banned?: … })` : le champ est typé. Si `tsc` proteste, chercher la cause plutôt que la masquer. |
| — | Vérifier que la migration générée porte bien le numéro **0017** (la dernière en place est `0016_account_issuer.sql`). |
| — | Le refactor `lockCallerAndTarget` n'est pas demandé par la spec : s'il est conservé, ne pas perdre les commentaires `features/users/actions.ts:57-63` et `:87-88`. |

**Finition**

| # | Point |
| --- | --- |
| 8 | Corriger le repli d'affichage (« un compte supprimé ») et remplacer le test « auteur supprimé » par un test « auteur anonymisé ». |
| 9 | Nommer le consommateur de `transactions.refunded_at` dans la spec, ou retirer la colonne du lot 1. |
| 10 | Corriger l'ancre `users-table.tsx:229-241` → `232-243`. |
| 11 | Noter le point de vigilance de merge avec `feat/socle-courriels` (trois expéditeurs de courriel sans garde `banned`). |
| — | Ajouter le test « `getUserBans` limite à 20 » que la spec demande et que le plan omet. |
| — | Retirer des Tasks 6 et 10 les contingences inutiles (`sign-up-form.test.tsx`, `Textarea`), qui invitent à toucher du code sain. |

---

## 7. Confirmations de sécurité opérationnelle

- **Lecture seule respectée.** Aucun fichier du dépôt n'a été créé, modifié ou
  supprimé, à la seule exception de ce rapport. La spec et le plan sont intacts
  (`git status --short` ne montre que les trois fichiers non suivis de la
  campagne).
- **Une version antérieure de ce rapport existait** au même chemin (52 370
  octets, non suivie par git). Elle a été copiée dans le répertoire temporaire de
  session avant d'être remplacée, pour ne rien perdre :
  `…\Temp\claude\c--Users-samue-Downloads-Code-NOMAqBANK\1c3d47f8-…\scratchpad\revue-bannissement-precedente.md`.
- **Commandes exécutées** : `git status`/`log`/`branch`/`diff` (lecture),
  `cat`/`sed`/`grep`/`ls`/`find`/`wc`/`cp` (lecture, plus la copie de sauvegarde
  ci-dessus hors du dépôt), et l'unique commande de gate autorisée
  `bun run check` (exit 0). Aucun `git add`, `commit`, `push`, `stash` ni
  `checkout`.
- **Base de données intacte.** Aucun `bun run test:integration`, `db:migrate`,
  `db:generate` ni `bun dev`. Aucun outil MCP Neon appelé — ni en lecture ni en
  écriture. Le projet de production `lucky-waterfall-33371811` / branche
  `br-blue-moon-adhu1l69` n'a jamais été touché.
- **Secrets.** Aucun `.env*` ni `.credentials.json` ouvert, lu ou imprimé.
  `lib/env/schema.ts` n'a été consulté que pour la déclaration de `SUPPORT_EMAIL`
  (`:44`), qui ne contient aucune valeur.
- **Aucun déploiement, aucune commande destructive.**
