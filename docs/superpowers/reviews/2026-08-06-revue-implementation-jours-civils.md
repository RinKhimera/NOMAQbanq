# Revue adversariale — jours civils de l'Est (#131 / #132)

- **Date** : 2026-08-06
- **Périmètre** : `git diff main...HEAD` sur `fix/131-flaky-question-browser` — 3 commits (`4c75300`, `c916bf9`, `3b22423`), 10 fichiers, +409/−56. Ferme #131 (test flaky question-browser) et #132 (filtre de dates admin/utilisateurs).
- **Méthode** : lecture seule, posture hostile ; chaque constat prouvé par lecture du code (`fichier:ligne`) et chaque suspicion soumise à une tentative de réfutation avant d'être retenue (section « faux positifs »).
- **Gates** :
  - `bun run check` (prettier + tsc + eslint) : **exit 0**
  - `bun run test` (frontend, 111 fichiers / 1286 tests) : **exit 0** — relancé 3× au total, 3× vert
  - `bun run test:integration` (branche Neon éphémère créée puis détruite, 328 tests) : **exit 0**
  - `tests/components/admin/question-browser.test.tsx` seul : **15 runs consécutifs, 15× vert** (le critère « 20 runs de suite complète » de #131 n'a pas été rejoué littéralement — voir constat n° 5)

## 1. Tableau des constats (par sévérité)

| # | Sév | Localisation | Problème | Régression ? |
|---|-----|--------------|----------|--------------|
| 1 | 🟡 | [users-manager.tsx:92-93](app/(admin)/admin/utilisateurs/_components/users-manager.tsx#L92-L93) + [users-filter-bar.tsx:62-75](app/(admin)/admin/utilisateurs/_components/users-filter-bar.tsx#L62-L75) | Le critère d'acceptation n° 4 de #132 (« Les presets restent inchangés dans leur comportement ») n'est pas tenu : les presets passent désormais par `toCalendarDay` et changent de sémantique (fenêtre d'instants exacts → journées civiles, lues dans le jour local du navigateur) | Changement volontaire non couvert par l'issue |
| 2 | 🟡 | [actions.ts:39-44](features/users/actions.ts#L39-L44) + [format.ts:51-55](lib/format.ts#L51-L55) | `loadUsersPage` ne fait aucun `zod.safeParse` alors que le contrat DAL est devenu « chaîne stricte qui lève » — un payload forgé produit un throw serveur (bruit Sentry) et un toast client trompeur (« Vérifiez votre réseau ») | Non (l'action n'a jamais validé) ; le diff durcit le mode d'échec |
| 3 | ℹ️ | [format.ts:49-55](lib/format.ts#L49-L55) | `parseCalendarDay` valide la **forme**, pas la **plage** : `"2026-99-99"` ou `"0099-01-01"` sont acceptés et normalisés en silence (mois 98 → ~2034 ; année 99 → 1999 via la sémantique native de `Date`) | Non |
| 4 | ℹ️ | [admin-dashboard-dal.test.ts:249](tests/integration/admin-dashboard-dal.test.ts#L249) · [payments-stripe.test.ts:561-563](tests/integration/payments-stripe.test.ts#L561-L563) | Course de minuit résiduelle sur les assertions de **somme** (baseline capturée avant, fenêtre relue après) — même classe qu'avant le diff, mais la frontière passe de minuit UTC (20 h à Toronto, heure de bureau) à minuit de l'Est (amélioration pratique) | Non — préexistant, probabilité réduite |
| 5 | ℹ️ | Issue #131, critère 1 | « `bun run test` passe 20 fois d'affilée » n'a pas été rejoué à la lettre par cette revue (3 suites complètes + 15 runs du fichier, tous verts) ; le déterminisme est acquis par construction (plus aucune attente réelle) | — |
| 6 | ℹ️ | [payments/dal.ts:608-611](features/payments/dal.ts#L608-L611) | `sql.raw` pour le fuseau : sûr aujourd'hui (constante module), mais une formulation Drizzle sans `sql.raw` existe (`GROUP BY` ordinal `sql\`1\``) — précédent évitable | Non |
| 7 | ℹ️ | [export.ts:25](lib/export.ts#L25) | Résiduel hors périmètre : le nom de fichier d'export utilise le jour UTC (`toISOString().split("T")[0]`) — décalé d'un jour le soir à Toronto | Non — préexistant, cosmétique |

Aucun constat 🔴 ni 🟠 : je n'ai trouvé **aucun bug fonctionnel, fuite, course ou trou d'autorisation** introduit par ce diff.

## 2. Détail par constat

### 1 — 🟡 Les presets de dates changent de comportement, contrairement au critère n° 4 de #132

**Code.** [users-filter-bar.tsx:62-75](app/(admin)/admin/utilisateurs/_components/users-filter-bar.tsx#L62-L75) construit toujours `this_month`/`last_30`/`last_90` en heure locale navigateur (`new Date(now.getFullYear(), now.getMonth(), 1)`, `now − 30×24h`). Mais [users-manager.tsx:92-93](app/(admin)/admin/utilisateurs/_components/users-manager.tsx#L92-L93) convertit désormais **tout** `dateRange` — presets compris — via `toCalendarDay` (jour civil local), résolu côté DAL en bornes de l'Est ([users/dal.ts:337-340](features/users/dal.ts#L337-L340)).

**Pourquoi c'est un vrai constat.** L'issue #132 exige : « Les presets restent inchangés dans leur comportement ». Or :
- *Avant* : `last_30` = fenêtre d'instants exacts `[now − 720 h, now]`.
- *Après* : `last_30` = journées civiles `[début du jour local d'il y a 30 j (résolu en heure de l'Est), fin du jour local courant]` — la borne basse s'élargit jusqu'à ~24 h (toute la journée civile du 30ᵉ jour est incluse), la borne haute couvre toute la journée en cours.
- Pour un admin **hors fuseau de l'Est**, la journée locale peut différer de la journée de l'Est : à Paris le 1ᵉʳ août à 00:30 (= 31 juillet 18:30 à Toronto), « Ce mois » envoie `dateFrom = "2026-08-01"` → borne = 1ᵉʳ août 00:00 de l'Est → **liste vide**, alors que la table affiche des inscriptions « 31 juil. ». Symétriquement, un navigateur en retard (Vancouver à 01:00 de l'Est) exclut de « 30 derniers jours » un compte affiché « aujourd'hui ».

C'est un changement globalement **améliorant** (sémantique alignée sur la journée de plateforme, cohérent avec le correctif principal) et l'issue classe elle-même le résidu « presets en heure navigateur » en sévérité basse — mais le critère d'acceptation, tel qu'écrit, n'est pas rempli.

**Régression ?** Non au sens « casse » ; oui au sens « comportement modifié hors du périmètre annoncé ».

**Comment je l'ai prouvé.** Lecture croisée de `handlePresetClick` (aucun changement dans le diff), de `buildFilters` (changé), de `toCalendarDay` ([format.ts:95](lib/format.ts#L95), `format(d, "yyyy-MM-dd")` = jour **local**) et du critère n° 4 de `gh issue view 132`.

**Correctif suggéré.** Aucun changement de code requis si la décision est assumée (elle est raisonnable). En fermant #132, cocher le critère n° 4 avec un commentaire expliquant l'écart, ou reformuler le critère. Option ultérieure (hors périmètre) : construire les presets sur la journée de l'Est (`toAppZoneCalendarDay(Date.now())` + `shiftCalendarDay`) pour éliminer le dernier résidu navigateur — trivial maintenant que les helpers existent.

### 2 — 🟡 `loadUsersPage` sans validation, sur un contrat DAL qui lève désormais

**Code.** [features/users/actions.ts:39-44](features/users/actions.ts#L39-L44) : `guard → return getUsersWithFilters(filters)`, aucun `safeParse`. [lib/format.ts:53](lib/format.ts#L53) : `parseCalendarDay` **lève** sur toute chaîne non `YYYY-MM-DD`. La convention du projet ([data-layer.md](/.claude/rules/data-layer.md), AGENTS.md) impose `guard → zod.safeParse → écriture`.

**Pourquoi c'est un vrai constat.** Un client légitime ne produit que des chaînes valides (`toCalendarDay` = `format(..., "yyyy-MM-dd")`, total sur toute `Date` valide). Mais l'action est un endpoint réseau : un admin (le guard est passé en premier — pas d'exposition anonyme) peut poster `dateFrom: "x"` et provoquer un throw serveur non capturé. Chemin réel de l'erreur : throw → erreur Server Action (message masqué en prod par Next, donc **pas de fuite**) → rejet côté client → attrapé par le `try/catch` de [users-manager.tsx:109-124](app/(admin)/admin/utilisateurs/_components/users-manager.tsx#L109-L124) → toast « Actualisation impossible. Vérifiez votre réseau. » (trompeur) + événement `onRequestError` dans Sentry (bruit évitable). Pas de 500 opaque non géré, pas d'unhandled rejection — mais pas conforme à la convention non plus.

**Régression ?** Non : l'action n'a **jamais** validé (avant le diff, `dateFrom: "x"` en epoch produisait `new Date(NaN)` et un échec de sérialisation Drizzle — throw aussi, plus profond). Le diff a changé la nature de l'échec, pas son existence.

**Comment je l'ai prouvé.** Lecture de l'action entière (aucun `safeParse` dans `loadUsersPage`, contrairement à `updateUserRole` juste en dessous, [actions.ts:70](features/users/actions.ts#L70)), du `try/catch` client, et de `parseCalendarDay`.

**Correctif suggéré (avant fusion, 15 min).** Un `usersFiltersSchema` zod (avec `dateFrom`/`dateTo` en `z.string().regex(CALENDAR_DAY).optional()`) consommé par `loadUsersPage`, échec → retour d'une page vide ou d'une erreur discriminée. Alternativement (minimum) : documenter l'écart comme assumé pour une lecture admin-only.

### 3 — ℹ️ Validation de forme, pas de plage

**Code.** [lib/format.ts:49-55](lib/format.ts#L49-L55) : `CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/` puis `Number(...)` sans borne. `"2026-99-99"` passe le regex ; mois 98 débordé par `Date.UTC`/`TZDate` → une date valide ~2034, filtre silencieusement vide. `"0099-01-01"` → sémantique années 0-99 du constructeur `Date(y, m, d)` → **1999**.

**Pourquoi c'est un (petit) constat.** Aucun producteur légitime n'émet ces formes ; l'effet est une liste vide, pas une erreur. C'est la contrepartie du choix « regex de forme » ; à corriger seulement si le constat n° 2 introduit un schéma zod (y intégrer la borne mois 01-12 / jour 01-31).

**Comment je l'ai prouvé.** Lecture du regex + sémantique ECMAScript de `MakeDay` (débordement normalisé) et du constructeur `Date` (années < 100 → 1900+y), vérifiée dans [mini.js:61](node_modules/@date-fns/tz/date/mini.js#L61) qui délègue au constructeur natif.

**Correctif suggéré.** Fusionner avec le n° 2 (regex + bornes dans le schéma zod). Pas bloquant.

### 4 — ℹ️ Courses de minuit résiduelles dans les tests d'intégration

**Code.**
- [admin-dashboard-dal.test.ts:60-63](tests/integration/admin-dashboard-dal.test.ts#L60-L63) fige `JOUR_SOIR`/`INSTANT_SOIR` au chargement du module — le **bucket** de `TX_SOIR` est donc immunisé contre un passage de minuit (le test dédié ligne 259-269 est robuste : les deux fenêtres — baseline et relecture — contiennent `JOUR_SOIR` tant que la suite ne dure pas 28 jours).
- MAIS l'assertion de **somme** ([ligne 249](tests/integration/admin-dashboard-dal.test.ts#L249)) compare `sumRevenue(r)` (fenêtre de 30 jours civils lue **à l'exécution du test**) à `sumRevenue(baseRevenue)` (fenêtre lue **au `beforeAll`**). Si minuit de l'Est passe entre les deux, la fenêtre glisse d'un jour : le jour le plus ancien sort, un nouveau jour entre. Le delta ne vaut plus `5000 + SOIR_CAD` **si la branche `develop` héritée porte du revenu sur le jour sorti**.
- [payments-stripe.test.ts:388-403 + 561-563](tests/integration/payments-stripe.test.ts#L388-L403) : `today()` est réévalué à chaque appel ; si minuit de l'Est passe entre le fulfillment des transactions seedées et l'assertion, elles tombent dans le bucket d'« hier » et le delta vaut 0.

**Pourquoi ce n'est qu'un ℹ️.** Ces fenêtres d'exposition durent quelques secondes et exigent que la suite chevauche **exactement** minuit de l'Est. Surtout, la même classe de course existait avant le diff — à minuit **UTC**, c'est-à-dire 20 h à Toronto, en pleine plage de travail : le diff a déplacé le risque vers 00 h de l'Est, où un run CI est bien moins probable. Le commentaire du test ([ligne 254-255](tests/integration/admin-dashboard-dal.test.ts#L254-L255)) revendique la robustesse pour le **dernier bucket** seulement, ce qui est exact.

**Régression ?** Non — probabilité réduite par rapport à `main`.

**Correctif suggéré.** Rien d'urgent. Si un jour ce flake se matérialise : restreindre l'assertion de somme aux jours `≥ JOUR_SOIR` (jeu figé), ou re-capturer la baseline dans le test.

### 5 — ℹ️ Critère « 20 runs d'affilée » de #131 : vérifié par construction, pas par 20 runs

**Code.** [question-browser.test.tsx:78-107](tests/components/admin/question-browser.test.tsx#L78-L107).

**Ce que j'ai vérifié.**
- **Le test reste un test** (critère 2 de #131, vérifié par lecture — la contrainte lecture seule interdit de casser `setPageState(1)` pour le prouver empiriquement) : les trois assertions sont synchrones et strictes. Si le reset de page au debounce ([question-browser-context.tsx:84-90](components/admin/question-browser/question-browser-context.tsx#L84-L90)) perdait `setPageState(1)`, le dernier appel serait `{ page: 2, search: "infarctus" }` et `toHaveBeenLastCalledWith(objectContaining({ page: 1, search: "infarctus" }))` ([ligne 101-103](tests/components/admin/question-browser.test.tsx#L101-L103)) échouerait. Si le debounce ne tirait pas, le dernier appel resterait `{ page: 2 }` sans `search` → échec aussi. Aucune assertion tautologique : `getByText`/`getByRole` lèvent en cas d'absence, et chaque `expect` est atteint séquentiellement (pas de promesse orpheline ; `settle` est bien `await`é).
- **La justification du renoncement à `waitFor`/`findBy*` est exacte** : `jestFakeTimersAreEnabled()` ([node_modules/@testing-library/dom/dist/helpers.js:14-28](node_modules/@testing-library/dom/dist/helpers.js#L14-L28)) ne détecte que le global `jest` ; sous Vitest il rend `false`, donc `waitFor` pollerait avec un `setInterval`… remplacé par l'horloge fake que personne n'avance → blocage jusqu'au timeout. Le helper `settle()` (act + `advanceTimersByTimeAsync`) est la bonne réponse.
- **Hygiène** : `vi.useRealTimers()` en `finally` — pas de fuite d'horloge vers les 3 autres tests du fichier même en cas d'échec.
- **Stabilité empirique** : suite complète 3× verte (dont une sous charge concurrente avec la suite d'intégration), fichier seul 15× vert. Plus aucune attente réelle (les 300 ms de debounce sont virtuelles) : la cause racine du timeout de 5 s identifiée par #131 est éliminée par construction, pas contournée.

**Correctif suggéré.** Aucun. Au moment de fermer #131, noter que le critère 1 a été validé par 3 suites + 15 runs ciblés + suppression de la dépendance au temps réel (ou lancer les 20 runs si le rituel importe).

### 6 — ℹ️ `sql.raw` évitable par un `GROUP BY` ordinal

**Code.** [payments/dal.ts:608-612](features/payments/dal.ts#L608-L612).

**Analyse.** Le problème 42803 est réel : Drizzle ré-émet un template `sql` avec de **nouveaux** paramètres liés à chaque usage, donc le `GROUP BY` porterait un `$n` différent du `SELECT` et Postgres ne reconnaît pas la même expression. Le contournement `sql.raw('America/Toronto')` est **sûr aujourd'hui** : `APP_TIME_ZONE` est une constante littérale du module ([format.ts:12](lib/format.ts#L12)), aucun chemin utilisateur n'y écrit, et aucun identifiant IANA ne contient d'apostrophe. Mais une formulation sans `sql.raw` existe : Postgres accepte le **numéro ordinal de colonne de sortie** dans `GROUP BY` — `.groupBy(sql`1`, transactions.currency)` (un template sans interpolation n'émet aucun paramètre) garde le fuseau en paramètre lié dans le seul `SELECT`. Le commentaire en place ([dal.ts:608-610](features/payments/dal.ts#L608-L610)) borne correctement le précédent.

**Correctif suggéré.** Polish optionnel : remplacer par le `GROUP BY` ordinal pour ne laisser aucun `sql.raw` dans le dépôt. Non bloquant.

### 7 — ℹ️ Nom de fichier d'export en jour UTC

**Code.** [lib/export.ts:25](lib/export.ts#L25) : `timestampedFilename` suffixe le jour UTC. Un export lancé à 21 h à Toronto est daté du lendemain. Cosmétique, hors périmètre du diff, et le module se déclare volontairement gelé ([export.ts:5-7](lib/export.ts#L5-L7)). Signalé uniquement parce que le sweep « dérivations de jour » l'a fait remonter comme dernier site du genre.

## 3. Faux positifs écartés

| Suspicion | Preuve qui l'écarte |
|-----------|---------------------|
| Le débordement de mois négatif de `startOfAppZoneMonth(d, -1)` serait un accident de `@date-fns/tz` | [mini.js:61](node_modules/@date-fns/tz/date/mini.js#L61) (`this.setTime(+new Date(...args))`) et [mini.js:440](node_modules/@date-fns/tz/date/mini.js#L440) (`Date.UTC(...)`) délèguent **verbatim** aux constructeurs natifs ; la normalisation d'un mois hors plage est la sémantique ECMAScript de `MakeDay` (spec, pas implémentation) — garantie tant que TZDate passe les arguments tels quels, ce que sa correction DST (`constructorArgsToInternalTime`) suppose aussi |
| `getDashboardTrends` aurait changé de fenêtre (l'assertion passe à `5000 + SOIR_CAD`) | [analytics/dal.ts:151-156](features/analytics/dal.ts#L151-L156) : fenêtres glissantes `now − 30/60 j` **inchangées** par le diff ; le delta bouge uniquement parce que `TX_SOIR` (hier 21 h de l'Est, donc dans les 30 derniers jours) est une **nouvelle ligne seedée** |
| Le seed `dateUsers` (juillet 2026) fausserait `newThisMonth`/les autres compteurs de `users-admin-dal` | [users-admin-dal.test.ts:583-587](tests/integration/users-admin-dal.test.ts#L583-L587) : `totalUsers` attend bien `5 + dateUsers.length` ; `newThisMonth` reste 5 car juillet 2026 < début du mois courant de l'Est (et restera dans le passé pour tout run futur — dates fixes) ; le jeu est isolé par `search: dateSuffix` dans les tests de plage ; suite d'intégration verte |
| `TX_SOIR` casserait les deltas de `getAdminStats`/`getFailedPaymentsCount` du même fichier | [admin-dashboard-dal.test.ts:228-238](tests/integration/admin-dashboard-dal.test.ts#L228-L238) : `getAdminStats` ne compte que users/examens/participations (pas de revenu) ; `getFailedPaymentsCount` ne compte que `failed` ; les deux assertions de revenu impactées ont été mises à jour dans le diff |
| `INSTANT_SOIR = startOfNextAppZoneDay − 3 h` pourrait ne pas tomber à 21 h les jours de changement d'heure | Les transitions de Toronto ont lieu à 02:00 : la soustraction de 3 h depuis minuit suivant reste dans le même régime d'offset que la soirée visée — 21 h mur-horloge dans tous les cas ; le test [format.test.ts « 23/25 h »](tests/lib/format.test.ts) couvre les deux transitions |
| `startOfAppZoneDay` casserait si minuit n'existe pas (fuseaux à DST-à-minuit type Santiago) | Non applicable : `APP_TIME_ZONE` est une constante `America/Toronto` (transitions à 02:00) ; aucun chemin ne passe un autre fuseau |
| Les faux timers pourraient laisser le fetch de montage non flushé → assertions vides mais vertes | Impossible : `getByText("Question 0")` **lève** si le rendu n'est pas là, et `toHaveBeenLastCalledWith` est strict ; 15 runs + 3 suites verts ; `advanceTimersByTimeAsync` sous `act` draine timers **et** microtâches |
| L'injection SQL via `sql.raw(APP_TIME_ZONE)` | Constante littérale du module ([format.ts:12](lib/format.ts#L12)), aucune écriture, aucun flux utilisateur ; reste le précédent (constat n° 6) |
| Le passage `gt(now − 30 j)` → `gte(début du plus ancien jour)` ferait double-compter ou perdre des lignes | La somme n'agrège que les buckets **affichés** : une ligne antérieure à `firstDay` est exclue par le `WHERE` ([dal.ts:626](features/payments/dal.ts#L626)), une ligne du premier jour va dans le bucket du premier jour ; l'élargissement corrige au contraire la barre tronquée du 30ᵉ jour (avant : bucket affiché mais somme coupée à `now − 720 h`) |
| Un autre appelant de `getUsersWithFilters` passerait encore des epoch ms | Grep exhaustif : deux appelants seulement — [page.tsx:16](app/(admin)/admin/utilisateurs/page.tsx#L16) (`{ limit: 50 }`, sans dates) et `loadUsersPage` ; `tsc` (exit 0) verrouille le type |
| D'autres filtres/agrégats du dépôt compareraient encore un jour UTC à l'affichage Toronto | Sweep `toISOString().slice`/`split`, `at time zone`, `date_trunc`, `getUTC*`, `Date.UTC`, `getMonth()/getFullYear()`, `setHours(0`, `startOfDay/endOfDay` sur `features/app/components/lib/hooks` : restent uniquement [export.ts:25](lib/export.ts#L25) (constat n° 7, nom de fichier), [users-filter-bar.tsx:66](app/(admin)/admin/utilisateurs/_components/users-filter-bar.tsx#L66) (presets, constat n° 1) et [exam-form.tsx:450](app/(admin)/admin/examens/_components/exam-form.tsx#L450) (`setHours(0,0,0,0)` pour désactiver les jours passés d'un date picker — exception assumée par data-layer.md) |
| `formatDateRange` afficherait un libellé incohérent avec ce qui est envoyé | [users-filter-bar.tsx:84-89](app/(admin)/admin/utilisateurs/_components/users-filter-bar.tsx#L84-L89) formate la `Date` locale du picker, et `toCalendarDay` transporte **le même jour local** — libellé et requête désignent la même case pour la sélection manuelle (l'incohérence résiduelle des presets est le constat n° 1, côté lignes affichées, pas côté libellé) |

## 4. Réponses aux questions ouvertes de l'auteur

1. **Contrat DAL non validé / lever est-il le bon mode d'échec ?** Le throw ne produit ni 500 opaque ni fuite : il est attrapé par le `try/catch` client ([users-manager.tsx:122-124](app/(admin)/admin/utilisateurs/_components/users-manager.tsx#L122-L124)) et remonte à Sentry via `onRequestError`. **Lever dans `parseCalendarDay` est le bon choix pour un helper de bas niveau** (une borne silencieusement ignorée serait pire : liste faussement « complète »). Le manque est au niveau de l'**action** : un `safeParse` conforme à la convention transformerait le payload forgé en réponse discriminée au lieu d'un événement Sentry + toast réseau trompeur. → constat n° 2, correctif 15 min recommandé avant fusion (non bloquant : surface admin-only, producteur unique type-safe).
2. **`sql.raw` pour le fuseau.** Diagnostic 42803 exact (Drizzle ré-émet des paramètres neufs par usage). Sûr aujourd'hui, précédent bien borné par le commentaire — mais **oui, une formulation sans `sql.raw` existe** : `GROUP BY` ordinal (`.groupBy(sql`1`, transactions.currency)` — un template sans interpolation n'émet aucun paramètre, et Postgres accepte le numéro de colonne de sortie). → constat n° 6, polish.
3. **Presets en heure navigateur.** L'incohérence visible **existe** dans des fenêtres étroites : navigateur en avance sur l'Est autour des frontières de mois/jour → « Ce mois » peut rendre une liste vide alors que la table affiche des inscriptions « 31 juil. » ; navigateur en retard → un compte affiché « aujourd'hui » absent de « 30 derniers jours ». Le libellé du bouton, lui, reste cohérent avec ce qui est envoyé (même jour local). L'issue assume ce résidu (sévérité basse) — décision défendable, **mais** le critère « presets inchangés » est formellement violé puisque leur sémantique passe d'instants exacts à journées civiles. → constat n° 1 : documenter à la fermeture de #132.
4. **Inventaire des écarts de comportement.** (a) Filtre manuel : journée de fin incluse en entier + bornes en jours de l'Est — **c'est #132**. (b) Presets : instants exacts → journées civiles locales (constat n° 1) — non couvert par l'issue. (c) Buckets du graphe de revenus : jour UTC → jour de l'Est — extension volontaire (commit `3b22423`), pas exigée par #132 mais résout l'incohérence que data-layer.md documentait comme « pré-existant, non corrigé » ; les libellés du graphe ([revenue-chart-content.tsx:59](components/admin/dashboard/revenue-chart-content.tsx#L59), `parseISO` sur date-only) restent corrects. (d) Fenêtre de `getRevenueByDay` : `gt(now − 30 j)` → `gte(début du plus ancien jour affiché)` — le premier bucket n'est plus tronqué (avant, sa barre ne comptait que la fraction postérieure à `now − 720 h`) et une transaction exactement à la borne entre (gt→gte) ; conséquence directe de (c), justifiée. (e) `newThisMonth`/`newLastMonth` : mois UTC → mois de l'Est — extension volontaire du même commit, cohérente avec l'affichage (une inscription du 31 à 21 h reste dans son mois) ; non exigée par une issue mais alignée. (f) Contrat `UsersFilters` : epoch ms → `YYYY-MM-DD` + throw (constats n° 2/3). **Rien d'accidentel détecté** ; (b), (c) et (e) méritent une mention explicite à la fermeture des issues puisqu'ils changent des chiffres qu'un admin regarde.
5. **`startOfAppZoneMonth(d, -1)` et le débordement de mois.** Comportement **garanti par la spec ECMAScript**, pas par `@date-fns/tz` : TZDate passe ses arguments verbatim à `new Date(...args)` ([mini.js:61](node_modules/@date-fns/tz/date/mini.js#L61)) et à `Date.UTC` ([mini.js:440](node_modules/@date-fns/tz/date/mini.js#L440)), dont la normalisation des mois hors plage est `MakeDay` (spec). Une montée de version qui cesserait de déléguer au constructeur natif casserait bien plus que ce point, et le test [format.test.ts (janvier − 1 → décembre 2025)](tests/lib/format.test.ts) le verrouille. Solide.
6. **Course autour de minuit.** Les jeux figés (`JOUR_SOIR`/`INSTANT_SOIR`) immunisent les assertions **de bucket** ; restent exposées les assertions **de somme/delta** dont la baseline et la relecture encadrent un éventuel minuit de l'Est (constat n° 4) — même classe qu'avant le diff, frontière déplacée de 20 h heure locale (UTC-minuit) vers 00 h de l'Est : risque pratiquement réduit. Sweep des tests : plus **aucun** test ne compare un jour UTC à un bucket de l'Est (les deux seuls `Date.UTC` restants — `account-deletion.test.ts:8`, `DashboardHero.test.tsx:14` — construisent des horloges fixes, pas des jours de bucket).
7. **Le test de #131 est-il encore un test ?** Oui — assertions strictes, atteintes, sensibles au retrait du reset de page comme à la disparition du debounce ; le renoncement à `waitFor` est fondé sur une limitation réelle de `@testing-library/dom` (détection Jest-only des fake timers) ; hygiène `finally`/`useRealTimers` correcte ; 15 runs + 3 suites verts. Détail au constat n° 5.

## 5. Verdict

**OUI — fusionner est sûr.** Aucun constat bloquant : pas de bug fonctionnel introduit, pas de régression d'autorisation ni de fuite, gates tous verts (check 0, test 0 ×3, intégration 0), et les deux corrections font ce que leurs issues demandent sur le fond. Deux réserves **avant de fermer les issues** (pas avant de fusionner) : le critère « presets inchangés » de #132 est formellement violé (constat n° 1 — à documenter, le changement est améliorant) et le critère « 20 runs » de #131 a été validé par construction + 18 runs, pas par le rituel littéral (constat n° 5).

| Priorité | Correctif | Constat |
|----------|-----------|---------|
| Avant fusion (recommandé, non bloquant) | `zod.safeParse` dans `loadUsersPage` (avec bornes de plage sur `YYYY-MM-DD`) | n° 2 + n° 3 |
| À la fermeture des issues | Documenter l'écart des presets (#132, critère 4) et la validation du critère « 20 runs » (#131) ; mentionner les extensions volontaires (buckets revenus, `newThisMonth`) | n° 1, n° 5 |
| Polish (plus tard) | `GROUP BY` ordinal à la place de `sql.raw` ; presets ancrés sur l'Est ; jour local dans `timestampedFilename` | n° 6, n° 1, n° 7 |

## 6. Confirmations de sécurité opérationnelle

- **Lecture seule respectée** : aucun fichier source modifié ; seul écrit = ce rapport (non commité).
- **Neon** : aucune branche persistante créée ; l'unique branche éphémère est celle du script `test:integration`, créée et **détruite par le script lui-même** (« branche supprimée » en fin de log). Branches `main`/`develop` non touchées ; aucun `db:migrate`/`db:push` manuel.
- **Secrets** : aucun `.env*` ouvert ni affiché.
- **Serveurs** : aucun `bun dev` ni serveur lancé. Commandes exécutées : `git diff/log`, `gh issue view`, greps/lectures, `bun run check`, `bun run test` (×3 + 15 runs ciblés), `bun run test:integration` (×1).
