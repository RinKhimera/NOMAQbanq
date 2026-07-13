# Campagne fiabilité Sentry — issues GitHub #103, #104, #105

**Date** : 2026-07-13
**Contexte** : triage Sentry du 2026-07-13 — backlog vidé (4 issues résolues), 2 vraies issues restantes (NOMAQBANQ-Z, NOMAQBANQ-14) + 1 cause racine de bruit (Sentry actif en dev). Chaque sujet a son issue GitHub : [#103](https://github.com/RinKhimera/NOMAQbanq/issues/103), [#104](https://github.com/RinKhimera/NOMAQbanq/issues/104), [#105](https://github.com/RinKhimera/NOMAQbanq/issues/105).

## Objectif

Éliminer le seul crash fatal récurrent de prod (#103), couper le bruit dev/e2e qui pollue le triage Sentry (#105), et statuer sur le crash d'hydratation de la page résultats d'entraînement (#104) par une investigation encadrée plutôt qu'un filtre à l'aveugle.

## Livraison

- Branche `fix/sentry-fiabilite` depuis `main`, **3 commits ciblés** (un par issue), **une PR**.
- Ordre d'implémentation : **#105 → #103 → #104** (couper le bruit d'abord, mécanique ensuite, investigation en dernier).
- Gates : `bun run check` + suite de tests existante. Pas de nouveau test sauf si le fix #104 touche du code applicatif.

---

## 1. #103 — Handler d'erreur sur le Pool pg

**Problème** (Sentry NOMAQBANQ-Z, fatal, 8 événements / 6 users du 2026-06-25 au 2026-07-09) : `db/index.ts` crée le `Pool` pg sans listener `error`. Quand Neon (ou le réseau) coupe une connexion **idle** du pool, `pg` émet `error` sur le pool ; sans listener, Node lève `uncaughtException` → crash de l'instance Fluid Compute.

**Fix** (`db/index.ts`) :

```ts
pool.on("error", (err) => {
  console.warn("[pg pool] connexion idle perdue", err.message)
})
```

- Le pool retire lui-même le client mort et en recrée un à la prochaine requête : il n'y a rien d'autre à faire que ne pas crasher.
- `console.warn` n'est visible que dans les **logs Vercel** : sans `consoleLoggingIntegration` (opt-in, jamais activée par défaut), `console.*` ne devient qu'un breadcrumb — pas une entrée Sentry Logs, malgré `enableLogs: true`. Canal assumé et suffisant ; pas d'élargissement des `integrations`.
- **Pas de `Sentry.captureException`** : une coupure idle gérée est un non-événement ; en faire des events recréerait du bruit (l'inverse de #105).
- **Résiduel connu (accepté)** : un client **checked-out** (fenêtre `db.transaction`) n'est pas couvert — pg retire le listener du pool à l'acquisition et drizzle n'attache pas de listener `error` au client dédié. Si NOMAQBANQ-Z se rouvre avec une stack transactionnelle, c'est ce chemin résiduel, pas un échec du fix. À rappeler dans la PR comme clé de lecture post-déploiement.
- **Pas de changement de timeouts** : `idleTimeoutMillis` de pg vaut 10 s par défaut (< les ~5 min du pooler Neon) et `attachDatabasePool` draine déjà à la suspension d'instance. Les événements résiduels (reprise d'instance, reset réseau) sont couverts par le handler. YAGNI.

**Test** : aucun test dédié (config d'infra). Vérification post-déploiement : NOMAQBANQ-Z ne réapparaît pas (Sentry rouvre l'issue automatiquement en cas de récidive).

---

## 2. #105 — Gate d'environnement Sentry

**Problème** : les 3 configs Sentry initialisent le SDK sans gate — tout run `bun dev` ou e2e local (`localhost`, IP `::1`) envoie ses erreurs dans le projet Sentry de prod. 3 des 6 issues du dernier triage étaient ce bruit.

**Décision** : couper le dev local, **garder les previews Vercel** (détection d'erreurs avant merge), distinguer les environnements par tag.

**Fix** — dans `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` (+ une ligne dans `playwright.config.ts`) :

```ts
Sentry.init({
  enabled:
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SENTRY_DISABLED !== "1",
  // serveur + edge :
  environment: process.env.VERCEL_ENV ?? "development",
  // client (VERCEL_ENV absent du bundle navigateur) :
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production",
  // ... reste inchangé
})
```

- `NODE_ENV === "production"` coupe le **mode dev** (local et e2e locaux : `bun dev` = `NODE_ENV=development`) ; les builds preview et production Vercel envoient (les deux ont `NODE_ENV=production`).
- **Kill-switch `NEXT_PUBLIC_SENTRY_DISABLED`** : le chemin e2e CI déjà présent dans le repo (`playwright.config.ts` : `bun run build && bun run start` avec `NODE_ENV=production` dès que `CI` est posé) échapperait à la gate `NODE_ENV` seule — le DSN étant hardcodé, un futur job e2e CI renverrait le bruit HeadlessChrome en prod. `playwright.config.ts` pose donc `NEXT_PUBLIC_SENTRY_DISABLED: "1"` dans `webServer.env` (inliné au build client par la commande CI, lu au runtime par serveur/edge). La variable est absente des déploiements Vercel → aucun risque d'éteindre la prod, contrairement à une gate composée sur `NEXT_PUBLIC_VERCEL_ENV` qui dépendrait du toggle système-env.
- `environment` : `production` / `preview` filtrables dans les issues et alertes Sentry.
- **Côté client**, le fallback est `"production"` (pas `"development"`) : si `NEXT_PUBLIC_VERCEL_ENV` manque dans le bundle, `enabled` garantit déjà qu'on est dans un build prod — mal taguer en `development` un événement de prod serait pire que le fallback optimiste.
- **Prérequis à vérifier à l'implémentation** : l'option Vercel « Automatically expose System Environment Variables » doit être active pour que `NEXT_PUBLIC_VERCEL_ENV` existe. Vérification par le dashboard (Settings → Environment Variables) ou en lecture seule via `vercel api "/v9/projects/<projet>"` → champ `autoExposeSystemEnvs` (`vercel env ls` ne liste PAS les variables système et ne peut pas répondre). Si l'option est inactive : l'activer (préférence), le fallback couvrant l'intervalle.
- Le tunnel `/monitoring` (next.config.ts) et les DSN hardcodés ne bougent pas.

**Test** : aucun test dédié. Vérification : `bun run build` passe ; après déploiement, plus aucun événement `::1`/`localhost` dans Sentry ; les événements portent le tag `environment`.

---

## 3. #104 — Crash $RS / hydratation sur la page résultats d'entraînement

**Problème** (Sentry NOMAQBANQ-14, 3 événements / 3 users du 2026-06-29 au 2026-07-13, encore présent sur la release courante) : sur `/tableau-de-bord/entrainement/[sessionId]/resultats`, séquence React error **#418** (mismatch d'hydratation) → `TypeError: Cannot read properties of null (reading 'parentNode')` dans `$RS` (script inline du streaming React) → crash non géré. Chrome Mobile / Android uniquement.

**État de l'exploration préalable** (fait au design) :

- Aucun `toLocaleString`/`Intl`/`new Date()`/`Date.now()`/`Math.random()` dans `components/quiz/results/**` ni dans la page — l'hypothèse « formatage locale-dépendant » (pattern connu du projet, `.claude/rules/data-layer.md`) **ne colle pas** sur ce périmètre.
- L'utilisateur du dernier événement est à Kinshasa (francophone) — l'hypothèse « Google Translate » n'est **pas automatique** non plus (site déjà en français).

**Phase A — investigation (timeboxée ~30-45 min)** :

1. Visionner le replay Sentry (`b57925147b3a45a082f677685fb780dc`) et les tags des 3 événements (navigateurs, versions, marqueurs de traduction/extension).
2. Étendre l'audit d'hydratation à **tout l'arbre réellement rendu** par la page (pas seulement les fichiers au nom évocateur) : `SessionResultsHeader`, layout `(dashboard)`, sidebar, et les sous-arbres importés par `SessionResults` — `components/quiz/question-card/` (la 1re question est dépliée par défaut, donc rendue côté serveur), `components/quiz/session/`, `hooks/` — rendu conditionnel `typeof window`, ids non déterministes, contenu dépendant du viewport, attributs différant serveur/client.
3. Tentative de repro dans un vrai navigateur : émulation mobile + traduction forcée de la page (et/ou extension mutant le DOM).

**Phase B — décision (arbre encodé, un seul des trois chemins)** :

- **B1 · Mismatch réel identifié** → fix ciblé du composant fautif ; test si code applicatif touché ; NOMAQBANQ-14 résolue.
- **B2 · Mutation du DOM par un tiers confirmée ou fortement probable** → filtre `beforeSend` **étroit** dans `instrumentation-client.ts` : drop uniquement si le message est `Cannot read properties of null (reading 'parentNode')` **et** qu'une frame de la stack est `$RS`. Documenter le pattern dans `.claude/rules/data-layer.md` ; archiver NOMAQBANQ-14 ; fermer #104 en « bruit tiers documenté ».
- **B3 · Non concluant** → **aucun filtre à l'aveugle**. Ajouter du contexte de diagnostic (tag/contexte Sentry pertinent identifié en phase A, p. ex. marqueur de traduction du document) pour affiner au prochain événement ; consigner l'état dans l'issue GitHub #104, qui reste ouverte.

**Critère de done** : un des trois chemins B est pris et tracé (commit + commentaire d'issue).

---

## Hors périmètre

- Refonte de l'échantillonnage (`tracesSampleRate`, replays) — inchangé.
- Alerting Sentry (règles, notifications) — inchangé.
- Tout durcissement générique anti-extensions (meta `notranslate`, etc.) — refusé sauf preuve en B2 que c'est la cause ET qu'un filtre ne suffit pas.

## Risques

- **#105** : si `NEXT_PUBLIC_VERCEL_ENV` n'est pas exposée, les événements client prod/preview seront tous tagués `production` (fallback) jusqu'à activation de l'option — dégradé acceptable, corrigeable sans code.
- **#104-B2** : un filtre trop large masquerait de vrais bugs — d'où la double condition message + frame `$RS`, et le refus explicite du chemin B2 sans confirmation en phase A.
- **#103** : les coupures gérées ne sont visibles que dans les logs Vercel — c'est l'état **nominal** (pas un mode dégradé, cf. la note Sentry Logs de la section 1). Réévaluer si des symptômes applicatifs (latence, erreurs de requête) apparaissent. Résiduel « client checked-out en transaction » documenté section 1.
