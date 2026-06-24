# Revue adversariale — Phase 5.6 (dashboards Drizzle)

- **Date** : 2026-06-23
- **Scope** : `git diff 6a23b9b^..HEAD` (3 commits) sur la branche `migration/drizzle-neon`
  - `554c2da` feat(admin): dashboard admin sur Drizzle (5.6c)
  - `576f42b` feat(dashboard): dashboard étudiant sur Drizzle (5.6b)
  - `6a23b9b` feat(marketing): stats marketing + nav admin sur Drizzle (5.6a)
  - 23 fichiers — DAL `features/{marketing,exams,training,users,payments,analytics}`, pages
    `app/(admin)/admin` + `app/(dashboard)/dashboard` + wrappers `_components`, composants,
    hook `useMarketingStats`, tests d'intégration + unitaires.
- **Méthode** : lecture seule, hostile, chaque finding prouvé par lecture du code (réf
  `fichier:ligne`) et confronté à l'implémentation Convex source-de-vérité. Chaque bug suspecté
  a été soumis à un effort de réfutation ; les disculpés sont consignés en §4.
- **Gate** : `bun run check` (= `tsc --noEmit && eslint --max-warnings 0`) → **exit 0** ✓
  (aucune erreur de type, aucun warning ESLint).
- **Tests d'intégration** : NON exécutés (exigent `NEON_API_KEY`/`NEON_PROJECT_ID` + branche Neon
  jetable). Analyse statique uniquement.

---

## 1. Synthèse

La migration est **fidèle**. Les 14 fonctions DAL portées reproduisent la sémantique Convex
(fenêtres de dates, filtres de statut, arrondis, tri, masquage anti-triche, bypass admin). Les
divergences trouvées sont soit **intentionnelles et correctes** (suppression des plafonds
`take(n)` de Convex qui sous-comptaient à l'échelle ; correction du bug `take(100)` de
`getFailedPaymentsCount`), soit **immatérielles**. **Aucun trou d'auth, IDOR, fuite de données,
ni corruption.** Les findings sont des durcissements UX/robustesse, pas des bloquants.

## 2. Findings (triés par sévérité)

| #   | Sév | fichier:ligne | problème | régression ? |
| --- | --- | ------------- | -------- | ------------ |
| 1   | 🟡 basse | `app/(admin)/admin/page.tsx` ; `app/(dashboard)/dashboard/page.tsx` | Server Components async **sans `loading.tsx`** → squelette de chargement perdu ; `AdminDashboardSkeleton` orphelin | OUI (UX) |
| 2   | ℹ️ info | `features/exams/dal.ts:1110-1111` | `getMyRecentExams` : `.limit(200)` **sans `orderBy`** → sous-ensemble non-déterministe (Convex utilisait l'ordre d'index stable) | Marginale |
| 3   | ℹ️ info | `features/marketing/dal.ts:48` | `getMarketingStats` : `totalUsers` ne filtre pas `deletedAt`, alors que `totalQuestions` filtre `isNull(deletedAt)` — incohérence interne | NON |
| 4   | ℹ️ info | `tests/integration/admin-dashboard-dal.test.ts:180` | Assertion recalcule `new Date()` au temps d'assertion vs `now` capturé dans le DAL → flake possible au passage de minuit UTC | NON (test) |

## 3. Détail par finding

### 1 — 🟡 Perte du squelette de chargement (pages devenues SSR bloquant)

**Code**
- `app/(admin)/admin/page.tsx` : l'ancienne page `"use client"` rendait
  `<AdminDashboardSkeleton/>` tant que `adminStats | questionStats | transactionStats` étaient
  `undefined` (chargement Convex). La nouvelle page est un `export default async function` qui
  `await Promise.all([... 8 requêtes DAL ...])` **avant** de rendre quoi que ce soit, et il
  n'existe **aucun** `app/(admin)/admin/loading.tsx` (vérifié : `Glob` → 0 fichier).
- `app/(dashboard)/dashboard/page.tsx:` même schéma ; `DashboardSkeleton` n'est plus rendu que
  pour `if (!stats)` (cas « pas de session »), plus pendant le fetch ; pas de
  `app/(dashboard)/dashboard/loading.tsx` non plus.
- `AdminDashboardSkeleton` n'est désormais référencé que dans sa définition
  (`components/admin/dashboard/skeleton.tsx`) et le barrel `index.ts` — **plus aucune page** ne
  l'importe (orphelin).

**Pourquoi c'est un vrai bug** — Sans `loading.tsx` ni borne Suspense, une navigation vers
`/admin` suspend le segment jusqu'à résolution des 8 requêtes ; l'utilisateur reste sur l'écran
précédent (navigation client) ou sur une page vide (chargement dur), sans le squelette instantané
qu'offrait la version Convex. C'est une régression d'expérience perçue, et un composant
(`AdminDashboardSkeleton`) construit pour cet usage devient du code mort.

**Régression ?** OUI (UX uniquement ; pas de correction de données).

**Correctif suggéré** — Ajouter `app/(admin)/admin/loading.tsx` (rend `AdminDashboardSkeleton`)
et `app/(dashboard)/dashboard/loading.tsx` (rend `DashboardSkeleton`). Coût trivial, réutilise les
squelettes existants, restaure la parité UX.

---

### 2 — ℹ️ `getMyRecentExams` : `.limit(200)` sans `orderBy`

**Code** — `features/exams/dal.ts:1108-1111`
```
.from(exams)
.where(eq(exams.isActive, true))
.limit(200)
```
Convex (`convex/examStats.ts:280-285`) : `query("exams").withIndex("by_isActive", eq true).take(200)`
— parcours d'index, donc ordre **stable et déterministe**.

**Pourquoi c'est un vrai bug** — En SQL, `LIMIT` sans `ORDER BY` laisse l'ordre au planificateur
(seq scan, état du heap après vacuum…). Tant qu'il y a **< 200 examens actifs**, les deux versions
renvoient l'ensemble complet → aucun écart. Au-delà de 200, Drizzle sélectionne un sous-ensemble
arbitraire (potentiellement variable d'un appel à l'autre) ; un examen complété hors de ce
sous-ensemble manquerait au panneau « examens récents ». Convex avait le même plafond mais un
sous-ensemble déterministe. À l'échelle actuelle (examens blancs peu nombreux), non déclenchable.

**Régression ?** Marginale — pas de perte vs Convex au volume réel ; non-déterminisme à >200.

**Correctif suggéré** — `.orderBy(desc(exams.startDate)).limit(200)` pour un sous-ensemble stable
(et aligné sur le tri d'affichage). Idem par cohérence avec `getMyDashboardStats`
(`features/exams/dal.ts:1066-1068`, `count(*)` non borné — lui est correct).

---

### 3 — ℹ️ `getMarketingStats` : `totalUsers` ne filtre pas `deletedAt`

**Code** — `features/marketing/dal.ts:44-49`
```
const [users] = await db
  .select({ n: sql<number>`count(*)`.mapWith(Number) })
  .from(user)          // ← pas de .where(isNull(user.deletedAt))
```
À comparer avec le comptage des questions juste au-dessus
(`features/marketing/dal.ts:30-35`) qui filtre `isNull(questions.deletedAt)`, et avec
`getAdminStats` (`features/users/dal.ts`) / `getUsersStats` qui excluent les users soft-deleted.

**Pourquoi c'est un vrai bug** — Incohérence interne : la stat publique « utilisateurs » inclut
les comptes supprimés, contrairement aux stats admin. **Immatériel** en pratique :
`formatMarketingStat` arrondit au palier supérieur et suffixe « + », donc l'effet visible est nul
sauf franchissement de palier par des comptes supprimés.

**Régression ?** NON — Convex comptait tous les users (`users.take(1000)`, pas de concept de
soft-delete). Le filtre `deletedAt` est un concept du nouveau monde.

**Correctif suggéré (optionnel)** — Ajouter `.where(isNull(user.deletedAt))` pour cohérence avec
les autres comptages de users du DAL.

---

### 4 — ℹ️ Assertion de date fragile (flake minuit UTC)

**Code** — `tests/integration/admin-dashboard-dal.test.ts:180`
```
expect(r.CAD.at(-1)?.date).toBe(new Date().toISOString().slice(0, 10))
```
Le dernier bucket de `getRevenueByDay` est calculé à partir du `now` capturé **dans** le DAL au
moment de l'appel ; l'assertion recalcule `new Date()` indépendamment.

**Pourquoi c'est un vrai bug** — Si l'horloge franchit minuit UTC entre l'appel DAL et l'assertion,
les deux chaînes de date divergent → faux échec. Probabilité infime (TZ=UTC, fenêtre de quelques
ms), mais c'est une dépendance temporelle évitable dans un test.

**Régression ?** NON — nouveau test.

**Correctif suggéré** — Capturer `const today = new Date().toISOString().slice(0, 10)` **avant**
l'appel et comparer à ça, ou accepter `[avant-dernier, dernier]` bucket.

## 4. Faux positifs écartés (suspectés → disculpés)

1. **`hasAccess` bypass admin sur le dashboard étudiant** — Suspecté : `getMyDashboardStats`/
   `getMyRecentExams` appellent `hasAccess("exam", uid)` ; si `hasAccess` bypassait les admins, un
   admin verrait `availableExamsCount` = tous les examens actifs au lieu de 0 (vs Convex).
   **Disculpé** : `features/payments/dal.ts:74-93` — le bypass admin n'a lieu **que** sans `userId`
   (session courante) ; avec `userId` explicite, la fonction interroge l'entitlement réel de la
   cible, **sans** bypass. L'appelant passe toujours `uid` → parité exacte avec
   `convex/examStats.ts:208` (`userAccess.expiresAt > now`, pas de bypass). Le commentaire DAL est
   correct.

2. **`getRevenueByDay` : revenu du premier jour partiel droppé** — Suspecté : le filtre SQL
   `completedAt > now-30j` (timestamp glissant) inclut une fraction du jour `date(now-30j)`, mais
   `buildDays` n'émet que les jours `[now-29j … now]` → ce bucket est silencieusement perdu.
   **Disculpé** : comportement **identique** dans Convex (`convex/payments.ts:519-552` : même
   `completedAt > startDate` + `buildDaysArray` sur `i ∈ [days-1..0]`, mêmes clés UTC
   `toISOString().slice(0,10)`). Parité parfaite, pas une régression. (Le `safeDays` clampé
   1..365 de Drizzle est un durcissement ; appels par défaut `days=30` identiques.)

3. **`getExpiringAccess` : `innerJoin` sans `.unique()`** — Suspecté : lignes `userAccess`
   dupliquées par (user, type) → fausses alertes « expirant » ; ou lignes orphelines droppées par
   l'`innerJoin` (vs `user: null` chez Convex). **Disculpé** : `db/schema/payments.ts:126`
   `unique("user_access_user_access_type_unique").on(userId, accessType)` garantit une ligne
   unique par (user, type) — parité avec le `.unique()` Convex. `onDelete: "cascade"` sur `userId`
   (ligne 111) interdit les orphelins → l'`innerJoin` ne peut rien droper. Parité.

4. **`getMyScoreHistory` : `innerJoin exams` masque les participations d'examens supprimés** —
   Suspecté : Convex (`convex/examStats.ts:444`) retombe sur `"Examen"` si le titre est introuvable ;
   l'`innerJoin` Drizzle, lui, **droppe** la ligne. **Disculpé** : FK `exams → examParticipations`
   en `ON DELETE CASCADE` (confirmé par les `afterAll` des tests : « cascade participations »).
   Supprimer un examen emporte ses participations → aucune participation ne peut survivre à un
   examen absent. L'`innerJoin` est sûr.

5. **Test training : fragilité « 10 plus récentes »** — Suspecté : `getMyTrainingScoreHistory`
   ne renvoie que les 10 sessions complétées les plus récentes ; si USER_ID accumule ≥ 8 sessions
   complétées à `now` dans les describes précédents, ts1/ts2/ts3 (J-8/9/10) sortiraient de la
   fenêtre → `findIndex` = -1 → échec. **Disculpé** : USER_ID est l'unique user du fichier ; la
   seule session complétée par action (`completeTrainingSession`, `tests/integration/training.test.ts:154`)
   est **supprimée** par `deleteTrainingSession` (ligne 206, describe « gardes ») avant le describe
   score-history ; la session `s2` est *abandonnée*, pas complétée. Au moment du test, USER_ID n'a
   que ts1/ts2/ts3 → ordre stable. (Note : couplage d'exécution latent — si un futur test complète
   des sessions pour USER_ID au-dessus de ce describe, il casse. Pas un bug actuel.)

6. **`getAdminStats` / `getDashboardTrends` filtrent `deletedAt` sur les users, pas Convex** —
   Suspecté : divergence de comptage. **Disculpé** : Convex n'avait pas de soft-delete (un user
   supprimé disparaît de la table) ; filtrer `isNull(deletedAt)` **reproduit fidèlement** ce
   comportement dans le nouveau monde. Le commentaire « cohérent avec `getUsersStats` » est exact.
   (Idem `getRecentActivity` qui filtre `deletedAt` sur les inscriptions — corrige, ne régresse pas.)

7. **Suppression des plafonds `take(n)` de Convex** — `getAdminStats` (users 1000 / exams 500 /
   participations 2000), `getDashboardTrends` (3×2000), `getFailedPaymentsCount` (100),
   `getTransactionStats` (10000), `getMyDashboardStats` (participations 100) : Drizzle utilise des
   `count(*)`/agrégats SQL non bornés. **Disculpé** : divergence **intentionnelle et correcte** —
   les plafonds Convex sous-comptaient à l'échelle. `getFailedPaymentsCount` Convex
   (`convex/analytics.ts:303-310`) était même **buggé** (`take(100)` en ordre d'index ascendant
   puis filtre 7 j → pouvait renvoyer 0 malgré des échecs récents) ; Drizzle le corrige.

8. **Arrondi `round(avg(...))` SQL vs `Math.round(sum/count)` JS** — Suspecté : divergence de
   demi-arrondi. **Disculpé** : pour des scores positifs, Postgres `round(numeric)` et JS
   `Math.round` arrondissent tous deux le `.5` vers le haut → résultat identique
   (`getMyDashboardStats`, `getMyTrainingScoreHistory`).

9. **`completionRate` peut dépasser 100 %** — `completed/available×100` avec `available` = examens
   actifs et `completed` = participations complétées historiques (examens depuis désactivés inclus).
   **Disculpé** : quirk **pré-existant** porté à l'identique depuis la page Convex (même formule,
   mêmes sources). Pas une régression.

10. **`getRecentActivity` trie par `completedAt` vs Convex par `_creationTime`** — Drizzle ordonne
    les 5 paiements/examens par `completedAt desc` ; Convex par ordre d'insertion puis utilise
    `completedAt` comme timestamp. **Disculpé** : Drizzle est *plus* correct (ordonne par le champ
    affiché) ; écart immatériel (createdAt ≈ completedAt pour les transactions). Correction, pas
    régression.

## 5. Verdict

**Est-il sûr d'empiler la Phase 7 (Stripe) par-dessus la 5.6 ? → OUI.**

Aucun bloquant. Les DAL paiements/accès (`hasAccess`, `getExpiringAccess`, `getRevenueByDay`,
`getTransactionStats`, `getDashboardTrends`) sur lesquels la 5.6 s'appuie et que Stripe étendra
sont en parité sémantique avec Convex, correctement gardés (`requireRole(["admin"])` self-guard
dans chaque fonction admin), sans IDOR ni fuite. La frontière Server→Client ne passe que des
données sérialisables ; la modale de paiement manuel rafraîchit bien le dashboard via
`router.refresh()` (compense l'absence de réactivité Convex).

### Tableau de correctifs priorisé

| Priorité | Finding | Action |
| -------- | ------- | ------ |
| À corriger maintenant | — | (aucun) |
| Avant la bascule (purge Convex / prod) | #1 | Ajouter `loading.tsx` pour `/admin` et `/dashboard` (restaure le squelette) |
| Polish | #2 | `orderBy` sur le `.limit(200)` de `getMyRecentExams` |
| Polish | #3 | Filtrer `deletedAt` sur `totalUsers` marketing (cohérence) |
| Polish | #4 | Stabiliser l'assertion de date du test admin-dashboard |

## 6. Confirmations de sûreté opérationnelle

- **Lecture seule** : aucun fichier source modifié. Seul artefact écrit = ce rapport (non committé).
- **Prod Neon intouchée** : aucune requête SQL exécutée ; la branche `production`
  (`br-blue-moon-adhu1l69`) n'a pas été approchée. Tests d'intégration **non lancés** (creds Neon
  non utilisés, aucune branche jetable créée).
- **Secrets** : `.env.local` jamais lu ni imprimé.
- **Aucune commande destructive ni de déploiement.** Seule commande non-lecture : `bun run check`
  (gate type-check + lint), exit 0.
