# Revue adversariale — Migration Convex → Better Auth + Drizzle/Neon (Phases 4 → 5.2b)

> Revue indépendante et sceptique. Branche `migration/drizzle-neon`, de `afcadf4` (plan Phase 5) à `3c79cb1` (fin 5.2b).
> Vérifié contre le code réel, le schéma Drizzle, la base `develop` (Neon MCP) et `better-auth ^1.6.19`.
> Date : 2026-06-19. Aucune modification de code effectuée.

## Méthode & état vérifié
- `bun run check` → **exit 0** (tsc + eslint verts — la prétention de gate tient).
- Précision DB vérifiée sur `develop` (`lucky-waterfall-33371811` / `br-restless-morning-ad4uyo3t`) via `information_schema`.
- Lecture des 3 mutations critiques `convex/payments.ts` (recordManualPayment / updateManualTransaction / deleteManualTransaction) pour le pré-vol 5.2c.
- **Non lancé** : `bun run test` complet / coverage (conclusions ci-dessous établies statiquement) ni `bun run build`.

---

## Synthèse (go / no-go)

**Santé globale : correcte mais avec une dette d'autorisation et de tests qui doit être réglée AVANT 5.2c — pas après.** Le travail Better Auth est propre et le DAL/Actions converti (users, accès, produits, transactions keyset) est de bonne facture. **Deux choses doivent bouger maintenant** : (1) il n'existe **aucune garde de rôle côté serveur** sur l'arbre `/admin` (le layout est `"use client"`, `requireRole` n'est appelé nulle part dans `/admin`) — inoffensif aujourd'hui mais ça devient une **fuite de données cross-user** dès que 5.2c/5.2d convertissent les pages admin en Server Components lisant Neon ; (2) le data layer neuf est **hors périmètre de couverture** et **sans aucun test** — le « gate vert » est en partie un trompe-l'œil. **Go pour continuer**, mais conditionné à : poser la garde admin serveur + ajouter `refunded` à l'enum + figer la précision des timestamps keyset, **avant** de porter les paiements manuels.

---

## Constats priorisés

### 🔴 Critique

#### C1 — Aucune autorisation serveur sur `/admin` ; le commentaire prétend le contraire
**Preuve.**
- `app/(admin)/layout.tsx:1` → `"use client"`. Le layout ne fait qu'`<AdminProtection>` (composant **client**) autour de `DashboardShell`.
- `components/admin-protection.tsx:11-13` affirme : *« La protection serveur fait foi : les layouts admin appellent `requireRole(['admin'])` côté Server Component. »* — **faux**.
- `grep "requireRole|requireSession"` → aucune occurrence dans `app/(admin)/**`. `requireRole` n'est utilisé **nulle part**. `requireSession` n'apparaît que dans `features/payments/*` et `app/(dashboard)/.../abonnements/page.tsx`.
- La seule page admin convertie, `app/(admin)/admin/profil/page.tsx:8`, appelle `getCurrentUser()` **sans** `requireRole`.
- `proxy.ts:13` ne fait qu'un check **optimiste** de présence de cookie (aucune validation de session ni de rôle).

**Pourquoi ça compte.** `AdminProtection` (client) ne masque l'UI qu'**après** que le Server Component a tourné côté serveur, requêté la base et streamé le payload RSC. Tant que les pages admin restent des Client Components Convex (mortes sous le shim no-auth), il n'y a pas de fuite *réelle* aujourd'hui — `admin/transactions`, `admin/users`, `admin/page` sont encore `useQuery(api.*)`. **Mais la prochaine étape (5.2c admin transactions, 5.2d admin users, dashboard admin en passe finale) consiste précisément à transformer ces pages en Server Components lisant `getAllTransactions`/`getUsersWithFilters`/revenus.** À ce moment, **n'importe quel utilisateur authentifié non-admin** (cookie présent → passe le proxy) recevra le rendu serveur avec toutes les transactions, tous les users et le CA. Le commentaire mensonger rend quasi certain que le prochain implémenteur fera confiance à une garde qui n'existe pas.

**Prescription (à faire avant 5.2c).** Transformer `app/(admin)/layout.tsx` en **Server Component async** :
```tsx
// app/(admin)/layout.tsx — PLUS de "use client"
import { requireRole } from "@/lib/auth-guards"
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["admin"])              // garde serveur = source de vérité
  return <DashboardShell variant="admin">{children}</DashboardShell>
}
```
Garder `AdminProtection` en défense-en-profondeur si souhaité, mais ce n'est plus la garde primaire. Idem pour `app/(dashboard)/layout.tsx` : le passer en Server Component avec `await requireSession()` (aujourd'hui chaque page doit se garder elle-même, et `profil` ne le fait pas — cf. M-bis). Corriger ensuite le commentaire d'`admin-protection.tsx`.

---

### 🟠 Élevé

#### H1 — L'enum `transaction_status` n'a pas `refunded` → 5.2c cassera
**Preuve.**
- `db/schema/enums.ts:12-16` → `transactionStatus = ["pending","completed","failed"]`.
- Or `convex/payments.ts:1074` (`updateManualTransaction`) accepte `status: "completed" | "refunded"` et `:1094` déclenche la révocation sur `"refunded"`.
- L'UI utilise déjà `refunded` partout : `app/(admin)/admin/transactions/_components/transaction-filters.tsx:43` (`{ value: "refunded", label: "Remboursé" }`), `components/shared/payments/transaction-table.tsx:35,92`, `components/shared/payments/edit-transaction-modal.tsx:145,153,185,458`.

**Pourquoi ça compte.** Au portage de `updateManualTransaction` vers Drizzle, un `UPDATE ... SET status='refunded'` lèvera `invalid input value for enum transaction_status`. C'est un **blocker de 5.2c**, pas un détail.

**Prescription.** Ajouter `refunded` à l'enum **maintenant** : `transactionStatus = ["pending","completed","failed","refunded"]` + migration `ALTER TYPE transaction_status ADD VALUE 'refunded'` (note : `ADD VALUE` ne peut pas tourner dans une transaction drizzle-kit groupée — l'exécuter en migration isolée). Vérifier que les lectures/filtres admin keyset l'acceptent.

#### H2 — Curseur keyset en précision milliseconde vs colonne `timestamptz(6)` → lignes sautables
**Preuve.**
- `features/payments/dal.ts:176` encode le curseur avec `createdAt.toISOString()` (**précision ms** : `node-postgres` parse `timestamptz` en `Date` JS, qui tronque les microsecondes).
- DB vérifiée : `transactions.created_at` = `timestamp with time zone`, **`datetime_precision = 6`** (microsecondes possibles).
- `transactions.created_at` est défini `defaultNow()` (`db/schema/payments.ts:83`) → **toute transaction insérée sans `createdAt` explicite prendra `now()` à la microseconde**.
- Aujourd'hui masqué : `SELECT count(*) FILTER (sub-ms)` = **0/66** (toutes les lignes migrées viennent de `_creationTime` Convex, en ms).

**Pourquoi ça compte.** Prédicat de page suivante (`dal.ts:218-226`) : `createdAt < c OR (createdAt = c AND id < cid)`, avec `c` tronqué à la ms. Une ligne dont le `created_at` réel vaut `…500600` partageant la même milliseconde que le curseur `…500` ne satisfait **ni** `< …500000` **ni** `= …500000` → elle est **sautée** silencieusement. Improbable pour `getMyTransactions` (deux achats du même user dans la même ms), mais **le même schéma de curseur sera réutilisé par `getAllTransactions` (5.2c, tous users)** où des rafales de webhooks dans la même ms sont plausibles → vraie perte de lignes en pagination admin.

**Prescription.** Figer les colonnes triées en keyset à la milliseconde pour matcher `Date` JS : `timestamp("created_at", { withTimezone: true, precision: 3 })` (idem `id` text déjà exact). Alternative plus lourde : lire `created_at` en texte brut et comparer en microsecondes côté SQL. La précision 3 est le correctif simple et cohérent ; l'appliquer aussi aux autres colonnes qui serviront de clé keyset (transactions, plus tard exam/training history).

#### H3 — DAL `getAccessStatus(userId)` / `hasAccess(type, userId)` : zéro autorisation de l'appelant sur la surcharge `userId`
**Preuve.**
- `features/payments/dal.ts:34-63` (`getAccessStatus`) : si `userId` est fourni, **aucune** vérification que l'appelant a le droit de lire l'accès d'autrui.
- `features/payments/dal.ts:69-95` (`hasAccess`) : idem ; pire, le **bypass admin porte sur le rôle de la CIBLE** (`dal.ts:80-86`) — `hasAccess('exam', X)` renvoie `true` si `X` est admin, quel que soit l'appelant.

**Pourquoi ça compte.** Non exploité aujourd'hui (tous les call-sites convertis appellent `getAccessStatus()` **sans argument** ; le `getAccessStatus(...)` vu dans `admin/users/[id]/.../user-access-section.tsx` est un **homonyme** UI importé d'`access-badge.tsx`, pas le DAL). Mais le plan 5.2d (`getUserPanelData`, détail user) branchera la surcharge `userId` sur un identifiant venu de l'URL. Couplé à C1 (pas de garde admin serveur), c'est un IDOR prêt à éclore : sonder l'accès/abonnement de n'importe quel user.

**Prescription.** Soit faire la garde **dans** le DAL pour le chemin `userId` (`await requireRole(['admin'])` si `userId && userId !== session.user.id`), soit documenter durement le contrat et n'appeler la surcharge qu'après `requireRole`. Vu l'historique, mieux vaut la garde intrinsèque. Décider aussi la sémantique voulue du bypass-par-cible de `hasAccess`.

---

### 🟡 Moyen

#### M1 — Incohérence de fuseau : tables Better Auth en `timestamp` SANS tz, domaine en `timestamptz`
**Preuve (DB `develop`).** `user.created_at/updated_at`, `session.created_at/updated_at/expires_at`, `account.*` = **`timestamp without time zone`**. Tout le reste (`transactions`, `user_access`, `products`, `exam_participations`, `training_sessions`) = `timestamp with time zone`. C'est le schéma par défaut généré par Better Auth (`db/schema/auth.ts:30,43,45` n'ont pas `withTimezone`).

**Pourquoi ça compte.** `node-postgres` interprète `timestamp without time zone` dans le fuseau du process. Sur Vercel (TZ=UTC) c'est sans effet ; **en dev (machine Windows non-UTC), `session.expiresAt`/`ban_expires`/`user.createdAt` sont décalés** de l'offset local → expiration de session et affichage « membre depuis » faux en local. Latent, mais c'est exactement le genre de bug qui mord pendant les tests manuels d'auth.

**Prescription.** Aligner les colonnes auth sur `timestamptz` (Better Auth fonctionne avec ; le faire via migration), ou à défaut garantir `TZ=UTC` sur tous les environnements (y compris le shell dev) et le documenter.

#### M2 — `requireEmailVerification` non défini → connexion possible sans email vérifié
**Preuve.** `lib/auth.ts:28-35` : `emailAndPassword.enabled:true`, `sendOnSignUp:true`, **pas** de `requireEmailVerification`. Le commentaire renvoie l'enforcement à « la session migration » — qui n'existe nulle part.

**Pourquoi ça compte.** Un nouvel inscrit accède au dashboard avec un email **non vérifié** (potentiellement celui d'autrui), jusqu'à ce que le vrai propriétaire réagisse. Pour les users migrés (`emailVerified=true`) c'est voulu. Pour les nouveaux comptes payants, c'est une décision produit à prendre **explicitement**, pas par omission.

**Prescription.** Trancher avant bascule : si la confiance email importe, `emailAndPassword.requireEmailVerification: true` (en gardant le re-login migrés OK car ils sont déjà `emailVerified`). Sinon, documenter que c'est assumé.

#### M3 — Couverture de tests « fausse » : le data layer neuf est hors périmètre et sans tests
**Preuve.**
- `vitest.config.ts:29-36` `coverage.include` = `convex/**`, `lib/**`, `hooks/**`, `components/**`, `schemas/**`, `email/**`. **Ni `features/**` ni `db/**`.** → `getAccessStatus`, `hasAccess`, le keyset, `updateProfile` ne sont **ni mesurés ni exigés**.
- `grep "@/features" tests/` → **aucun fichier**. Zéro test DAL/Actions (la spec §9 les prévoyait sur branche Neon éphémère — différés).
- `tests/convex/**` = 14 fichiers testant du code **en cours de suppression** (`payments.test.ts`, `users.test.ts`…). Ils gonflent la couverture de `convex/**`.

**Pourquoi ça compte.** Le seuil 75 % reste vert en mesurant du code mort (Convex) + des composants inchangés, pendant que la logique métier réellement nouvelle a 0 test. **Falaise de couverture programmée en 5.6** quand `convex/` disparaîtra. Sous Option C (pas d'E2E full avant Phase 6/7), les tests d'intégration par domaine sont **le seul vrai gate** — et ils n'existent pas.

**Prescription.** Ajouter `features/**` et `db/**` au `coverage.include` **maintenant** (ça révélera la dette honnêtement, quitte à baisser temporairement le chiffre), puis écrire les tests d'intégration DAL/Actions sur branche Neon éphémère **au rythme de chaque sous-phase**, comme la spec le prévoyait. Au minimum : keyset (pages + tie-break), `getAccessStatus`/`hasAccess` (expiré/valide/admin), `updateProfile` (unicité + 23505).

#### M4 — Rate-limit Better Auth inactif en dev et non testé contre `storage:'database'`
**Preuve.** `lib/auth.ts:15` `rateLimit:{storage:'database'}`. Better Auth **désactive le rate-limit hors production** par défaut (pas de `enabled:true`). Le commentaire le reconnaît (« Actif en prod uniquement »).

**Pourquoi ça compte.** En dev, sign-in et reset password n'ont **aucune** protection brute-force ; et le chemin `storage:'database'` (table `rate_limit`) n'est jamais exercé avant la prod → risque qu'il soit cassé le jour J sans qu'on l'ait vu.

**Prescription.** Avant bascule, valider le rate-limit en mode prod-like (ou `rateLimit:{enabled:true, storage:'database'}` temporairement) : vérifier que la table `rate_limit` se remplit et bloque. Définir des limites explicites sur les routes sensibles (sign-in, request-password-reset) plutôt que de se reposer sur le défaut.

#### M5 — Révocation d'accès imprécise (à corriger au port 5.2c)
**Preuve.** `convex/payments.ts:1153-1177` (`handleAccessRevocation`) supprime **toute** la ligne `userAccess` si `lastTransactionId === transaction._id`, sinon ne fait **rien**. Et `updateUserAccess` (`:1196-1202`) écrase **toujours** `lastTransactionId` même quand `Math.max` conserve l'expiration existante.

**Pourquoi ça compte.** Sur-révocation (supprimer la dernière transaction d'un accès cumulé de 3 achats efface tout l'accès) et sous-révocation (supprimer une transaction non-« dernière » ne retire rien). Le `lastTransactionId` peut pointer une transaction qui n'a pas réellement fixé l'expiration → heuristique fragile. Le prompt demande « recalcul d'accès à la suppression » : **le code actuel ne recalcule pas.**

**Prescription.** Au port (5.2c), remplacer par un **recalcul réel** : à la suppression/refund, recalculer `expires_at` à partir des transactions `completed` restantes du couple (user, access_type), ou supprimer la ligne seulement si plus aucune transaction valide. Décider explicitement (réplication du comportement imparfait vs correction).

---

### 🟢 Faible

- **F1 — Shim Convex no-auth, footgun silencieux.** `providers/convex-client-provider.tsx:13-17` : `useNoAuth` rend les écrans non convertis **vides** au lieu d'erreur → en QA manuelle on ne distingue pas « migré et cassé » de « vide légitime ». De plus `new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)` (`:11`) plantera au montage si l'env est retiré **avant** le shim. *Prescription :* rendre un placeholder explicite « module en cours de migration » plutôt qu'un état vide ; retirer shim + env ensemble en 5.6.
- **F2 — `updateProfile` : conventions.** `features/users/actions.ts:64-66` utilise `revalidatePath` (le plan poussait `revalidateTag`) et revalide `/admin/profil` + `/dashboard/onboarding` (vérifier que ces routes existent). Retour `{success,error}` au lieu du contrat discriminé `{status,fieldErrors,formError}` du gabarit §0.3. *(Note : `user.updatedAt` a bien `$onUpdate` `db/schema/auth.ts:32-34`, donc l'horodatage se met à jour — RAS de ce côté.)* Fonctionnel ; cohérence seulement.
- **F3 — `recordManualPayment` non idempotent.** `convex/payments.ts:818` : pas de clé d'idempotence (les paiements manuels n'ont pas de `stripeEventId`). Double-clic admin → double transaction + double cumul. Mineur (admin) mais à couvrir au port (désactiver le bouton / clé de dédup).
- **F4 — Index keyset non composite.** `db/schema/payments.ts:88-98` a `(user_id)` et `(created_at)` séparés, pas `(user_id, created_at DESC, id DESC)` ni `(created_at DESC, id DESC)`. OK à 66/194 lignes ; à prévoir pour `getAllTransactions` (5.2c) afin d'éviter un tri en mémoire à l'échelle.

---

### Détails (corrects ou mineurs — pour mémoire)
- **Bien fait :** anti-énumération sur `forgot-password` (`app/(auth)/auth/forgot-password/page.tsx:75-77` « Si un compte existe… »), réservé même quand l'API réussit. `sign-in` s'appuie sur le message générique de Better Auth (pas d'énumération). `reset-password` lit le token via `useSearchParams` **sous `<Suspense>`** (`reset-password/page.tsx:165-171`) et gère l'absence de token (« Lien invalide »). Bon.
- **Re-login email/mdp (Phase 4) :** la conclusion empirique (un user migré sans `account` peut se servir de « mot de passe oublié », `resetPassword` crée le credential) est plausible et cohérente avec le code Better Auth. **Limite à ne pas oublier :** SES en sandbox → la vague de re-login massif n'est pas testable tant que l'accès prod SES n'est pas accordé ; le « succès » est prouvé sur 1 user de forme migrée, pas à l'échelle.
- **Politique de mot de passe :** min 8 / max 128 sans exigence de complexité (`schemas/auth.ts:9-12`) — conforme aux défauts Better Auth, acceptable.
- **Token reset en query string** (`?token=`) — standard Better Auth ; fuite possible via Referer/historique mais c'est le design amont. Acceptable.
- **`accountLinking.trustedProviders:['google']`** — raisonnable : Google vérifie les emails, donc le linking par email pour les users migrés (préserve l'id) est sain. Garder.
- **`taint` PII différé** (`next.config.ts` sans `experimental.taint`, `lib/dal.ts` sans `taintObjectReference`) — faible priorité : le DAL projette déjà des colonnes étroites et passe volontairement `email` aux Client Components (profil). Le taint apporterait peu ici ; OK de différer.
- **`images.remotePatterns`** garde `img.clerk.com`/`images.clerk.dev` (`next.config.ts:15-21`) — **correct** tant que les 183 avatars Clerk restent en URL externe ; à ré-héberger sur Bunny au cutover (sinon 404 si le compte Clerk ferme).

---

## Challenge des décisions de design

| Décision | Verdict | Argument |
|---|---|---|
| **Option C** (Better Auth now + suppression Clerk + casse transitoire) | **Garder, mais resserrer les gates** | Arbitrage défendable car la branche n'est jamais déployée. **Risque sous-estimé :** sous Option C il n'y a ni E2E full ni couverture sur `features/**`, donc le seul vrai filet (tests d'intégration DAL/Actions) doit exister — il n'existe pas (M3). Et le shim masque les casses en états vides (F1). Net : conserver, mais les tests d'intégration par domaine deviennent **non négociables**, pas « plus tard ». |
| **Shim Convex `useNoAuth`** | **Garder transitoirement** | Évite le crash de prerender, coût faible. Footgun = silence (F1). Préférer un placeholder explicite. |
| **Structure `features/<domaine>/{schemas,dal,actions}`** | **Garder** | Cohérent avec Proxéa, lisible, `server-only` respecté. `schemas.ts` absent côté payments — normal tant que 5.2c (zod paiement manuel) n'est pas fait. |
| **Gestion admin users → domaine payments ; dashboard admin en passe finale** | **OK** | Justifié : `convex/users.ts` mêle users + accès/paiements ; regrouper l'accès dans payments est cohérent. **Condition :** la garde admin serveur (C1) doit atterrir avec la **première** page admin convertie, pas « en passe finale ». |
| **Keyset pour les transactions** | **Bon choix** | Bonne implémentation (tuple `(createdAt,id)`, `limit+1`, curseur opaque validé, jointure produit unique, pas de N+1). **Deux réserves :** précision ms vs `timestamptz(6)` (H2) et index composite manquant (F4). |
| **`getAccessStatus` unique avec `userId?`** | **Ajuster** | Bonne consolidation, mais le contrat « userId = admin » n'est pas appliqué (H3). Mettre la garde dans le DAL. |

---

## Angles morts & risques de bascule (Phase 8)

1. **Garde admin (C1)** : si elle n'est pas posée avant 5.2c/5.2d, la première mise en prod expose transactions/users/CA à tout compte authentifié. **Priorité absolue.**
2. **Branche Neon `production` NON protégée** (mémoire + spec §3.1) : `neonctl set-protection` jamais passé. À protéger via console **avant** l'import prod réel.
3. **SES en sandbox** : re-login massif impossible sans accès prod SES. Dépendance dure du cutover.
4. **Falaise de couverture en 5.6** : retrait de `convex/` → effondrement du % si `features/**` n'est pas testé d'ici là (M3).
5. **Fuseaux (M1)** : sessions/bans en `timestamp` sans tz — vérifier TZ=UTC sur le runtime de prod (Vercel OK) et surtout en dev.
6. **Avatars Clerk** (183 URLs externes) à ré-héberger ; `NEXT_PUBLIC_CONVEX_URL`/`@clerk/*`/`convex` à retirer en bloc avec le shim (sinon build cassé — déjà noté dans le plan).
7. **`payment/success`** : c'est un Server Component lisant `getAccessStatus()` une fois. Quand le webhook Stripe arrivera (Phase 7), la page **ne se rafraîchira pas** à l'octroi d'accès (plus de réactivité Convex). Prévoir un `router.refresh()`/polling court ou un re-fetch après confirmation côté client, sinon l'utilisateur voit « pas encore d'accès » juste après paiement.
8. **Re-vérification d'accès à la soumission** (règle backend Convex) : à ne pas perdre en portant exam/training (5.4/5.5) — `hasAccess` doit être re-checké à la soumission, pas qu'au démarrage.

---

## Pré-vol 5.2c — portage des paiements manuels (pièges à ne pas rater)

Lecture faite de `recordManualPayment` (`convex/payments.ts:818`), `updateManualTransaction` (`:1067`), `deleteManualTransaction` (`:1114`), helpers `updateUserAccess` (`:1182`) / `handleAccessRevocation` (`:1153`).

1. **Atomicité (le piège n°1).** Convex rend chaque mutation atomique/sérialisable « gratuitement ». En Drizzle/Neon, `INSERT transaction` + `upsert userAccess` (×2 pour un combo) **doivent** être dans un seul `db.transaction(...)`. Un combo qui n'octroie qu'un des deux accès = état corrompu.

2. **Cumul correct sous READ COMMITTED (le piège subtil).** Le cumul non-combo n'est **pas** un simple `GREATEST` de deux dates : c'est `base = max(expiration_existante_si_future, now)` **puis `+ durationDays`** (`:858-871`). Donc un `ON CONFLICT … DO UPDATE SET expires_at = GREATEST(...)` naïf est **faux** (il ne ré-additionne pas la durée). Faire : `SELECT … FOR UPDATE` de la ligne `user_access` dans la transaction → calcul en JS → `UPDATE`, **ou** tout pousser en SQL : `expires_at = GREATEST(COALESCE(user_access.expires_at, now()), now()) + (duration_days || ' days')::interval`. Sans verrou de ligne, deux paiements concurrents (manuel + webhook) provoquent un **lost update** sur l'expiration.

3. **Idempotence.** Stripe (Phase 7) : s'appuyer sur `UNIQUE(stripe_event_id)` (existe, `db/schema/payments.ts:90`) + `ON CONFLICT (stripe_event_id) DO NOTHING` + re-check du `status` (cf. `completeStripeTransaction:691-716`). **Manuel : aucune clé d'idempotence** (F3) → prévoir une protection (bouton désactivé / dédup applicative).

4. **`refunded` manquant dans l'enum (H1)** — blocker direct de `updateManualTransaction`. À régler avant.

5. **Combo.** Octroyer `exam` ET `training` avec la **même** `accessExpiresAt`, dans la **même** transaction (`:893-920`). L'`UNIQUE(user_id, access_type)` borne bien à ≤ 2 lignes.

6. **Révocation/refund (M5).** Le comportement Convex (supprime la ligne d'accès si « dernière transaction ») est imprécis. Décider : répliquer tel quel (et le documenter comme dette) ou recalculer `expires_at` depuis les transactions `completed` restantes. Attention au `lastTransactionId` toujours écrasé même sans gain d'expiration.

7. **Garde admin.** Ces mutations utilisent `getAdminUserOrThrow`. Les Server Actions portées doivent commencer par `await requireRole(['admin'])` (et la page `admin/transactions` par la garde de layout C1).

---

## Ce que je ferais différemment (court)
1. **Avant 5.2c**, livrer un petit lot « durcissement » : (a) layout admin Server Component `requireRole`, (b) `refunded` dans l'enum, (c) précision `:3` sur les colonnes keyset, (d) garde `userId` dans `getAccessStatus`/`hasAccess`.
2. **Ajouter `features/**` + `db/**` à la couverture dès maintenant** et écrire les tests d'intégration DAL/Actions par domaine — sous Option C c'est le seul gate qui dit la vérité.
3. **Faire échouer fort plutôt que vide** : le shim Convex et les pages converties devraient signaler explicitement « non disponible / non autorisé » plutôt que rendre un état vide ou un profil hors contexte.
4. **Aligner les timestamps auth sur `timestamptz`** pour tuer la classe de bugs de fuseau d'un coup.

---

## Addendum (2026-06-19) — Confrontation aux skills

> 2ᵉ passe demandée : constats confrontés à `convex-to-betterauth-drizzle-neon` (références + gabarits),
> `better-auth-best-practices`, `better-auth-security-best-practices`, `neon-postgres`.

### A. Ce que les skills confirment (constats inchangés)
- **Authz dans chaque action/page sensible, même avec proxy** (réf. `02` §gardes, `04` « Autorisation dans chaque action sensible… pas seulement dans le proxy ») → conforte **C1** et **H3**.
- **Atomicité multi-écritures = `dbTx.transaction`** (`04`, `gotchas` Drizzle/Neon) → conforte le pré-vol 5.2c. Le driver retenu (un seul `pg` Pool node-postgres, pas `neon-http`) **est** le bon choix : `neon-http` ne supporte pas les transactions multi-statements (`gotchas`) et `neon-postgres` recommande exactement `pg` Pool au scope module sur Vercel Fluid Compute.
- **Contrat d'action discriminé `{status,fieldErrors,formError}` + `'use server'` async littérale** (`04`) → conforte **F2**.
- **`taint` PII dans `lib/dal.ts`** : `dal-example.ts.md` le qualifie « optionnel mais **fortement recommandé** » → mon classement Faible/différé tient, mais c'est bien une exigence du gabarit à honorer en Phase 7.

### B. Reclassements / précisions
- **M1 → Élevé (régression vs gabarit).** Le gabarit du projet `assets/schema-auth.ts.md` (l.32-34,45,50-51,64-69,78-81) met **`{ withTimezone: true }` sur TOUS** les timestamps auth. Le code réel (`db/schema/auth.ts`) a perdu le `withTimezone` sur `user.createdAt/updatedAt`, **tout** `session.*`, **tout** `account.*`, `verification.*` (défaut du CLI Better Auth qui a fui). Ce n'est donc pas une simple incohérence stylistique mais un **écart au pattern voulu** → corriger par migration `ALTER COLUMN … TYPE timestamptz`.
- **M2 → renforcé.** Le gabarit `02` (l.20-21) recommande `requireEmailVerification: true` **et** `sendOnSignIn: true` ; le code a abandonné les deux. Bonne nouvelle pour la décision : `requireEmailVerification` **ne bloque que `signInEmail`** (réf. `02` #2 ; Google pose `emailVerified=true`) → on peut l'activer **sans** casser le re-login Google des migrés. Sans `sendOnSignIn:true`, un user non vérifié qui tente de se connecter ne reçoit pas de nouveau lien.
- **M4 → précisé (j'avais sur-estimé).** En **prod**, Better Auth applique déjà **3 req/10 s** sur `/sign-in/*`, `/sign-up/*`, `/change-password`, `/change-email` (réf. `02` #5 + security skill) → le brute-force sign-in **est** atténué en prod. Restent : (a) **rien en dev** (acceptable, non déployé) ; (b) **`request-password-reset` n'est PAS dans la liste stricte** → ajouter une `customRules["/request-password-reset"]` (sinon seulement la limite globale 100/10 s ; vecteur spam/enumération-timing du « mot de passe oublié ») ; (c) chemin `storage:'database'` jamais exercé hors prod.

### C. Constats nouveaux révélés par les skills
- **N1 (Moyen) — `advanced.backgroundTasks.handler` absent.** `02` #14 + security skill : sur Vercel, sans `backgroundTasks: { handler: (p) => waitUntil(p) }`, l'envoi SES **bloque la réponse HTTP** (les callbacks `sendResetPassword`/`sendVerificationEmail` de `lib/auth.ts` sont `await`és). Anodin à l'unité, mais pendant la **vague de re-login** (tout le monde sur « mot de passe oublié »), chaque requête attend SES. *Prescription :* câbler `waitUntil` (`@vercel/functions`).
- **N2 (Faible) — `trustedOrigins` non configuré** (`lib/auth.ts`). OK tant que l'app et l'API sont même origine (baseURL auto-trusted, les `callbackURL`/`redirectTo` utilisés sont relatifs). À **prévoir pour les preview deployments Vercel** (URLs changeantes) et tout futur split de domaine, sinon `callbackURL`/`redirectTo` → 403. Checklist cutover.
- **N3 (Faible) — env d'auth trop laxiste.** `lib/env/schema.ts:21` valide `BETTER_AUTH_SECRET` en simple `z.string()` (**pas de `.min(32)`** ; Better Auth avertit <32 et rejette les placeholders en prod, mais la gate ne le fait pas). `GOOGLE_CLIENT_ID/SECRET` restent `optional()` alors que Phase 4 est finie et que `lib/auth.ts` fait `?? ""` (Google silencieusement cassé si absent). *Prescription :* `.min(32)` sur le secret, rendre les `GOOGLE_*` requis maintenant.
- **N4 (Faible, hardening optionnel) — pas d'audit via `databaseHooks`.** Pertinent vu la vague d'account-linking : logguer `account.linked` / `session.created` / `user.email_changed` (security skill §Database Hooks) facilite l'investigation post-bascule. Optionnel.
- **N5 (Détail — correct, à confirmer) — `setPassword` vs `changePassword`.** `profile-security.tsx:39` n'utilise QUE `changePassword` (current+new). C'est le **bon** choix de sécurité : `02` #7 avertit qu'offrir `setPassword` sans garde DB laisserait un hijacker de session contourner la vérif du mot de passe actuel. Conséquence assumée : un user **Google-only** (sans `account.password`, cas des migrés non encore passés par « mot de passe oublié ») **ne peut pas ajouter de mot de passe** via le profil (bloc « Comptes connectés … prochainement », Phase 7). Limitation connue, pas un défaut.
- **N6 (cutover, meilleure prescription) — protéger la branche Neon `production` via `neon.ts` (IaC).** Le `neonctl set-protection` manuel a échoué (pwsh/Zscaler). `neon-postgres` propose `neon.ts` : `branch.isDefault → { protected: true }` puis `neonctl deploy`. Plus robuste que la commande manuelle pour le risque de bascule #2.
- **N7 (checklist) — `attachDatabasePool`.** `neon-postgres` insiste : sur Vercel Fluid Compute, attacher le Pool (`attachDatabasePool` de `@vercel/functions`) pour que le runtime draine les connexions avant suspension. À confirmer dans `db/index.ts` (prévu par la spec §3.1).

### D. Non-défauts confirmés (ne pas « corriger »)
- **Access Control fin (`ac`/`roles`/`requirePermission`) absent = OK.** `lib/permissions.ts` n'existe pas (glob vide) ; le plugin admin est utilisé en mode simple `admin({ defaultRole, adminRoles })`, et `requireRole` lit `session.user.role` (peuplé par le plugin). Le « piège critique » du skill (`02` §rôles : `ac` créé mais non passé au plugin → permissions silencieuses) **ne s'applique pas** ici puisqu'aucun `ac` n'est créé. C'est un YAGNI assumé (Phase 4 self-review) et correct pour 2 rôles. Ne rien ajouter tant qu'un besoin réel n'apparaît pas.
- **`cookieCache` désactivé = OK.** `02` #1 : `cookieCache` ne cache pas `role` → le laisser off garantit un `role` toujours frais pour `requireRole` (au prix d'un hit DB par render, acceptable).
