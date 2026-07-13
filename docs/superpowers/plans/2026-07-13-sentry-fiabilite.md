# Campagne fiabilité Sentry (#103, #104, #105) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éliminer le crash fatal du Pool pg (#103), couper le bruit Sentry dev/e2e en gardant les previews (#105), et statuer sur le crash $RS/hydratation de la page résultats d'entraînement par investigation encadrée (#104).

**Architecture:** Trois changements indépendants, un commit par issue, sur une branche unique `fix/sentry-fiabilite`. #105 et #103 sont des changements de config pure (3 configs Sentry, `db/index.ts`). #104 est une investigation avec arbre de décision B1/B2/B3 encodé dans le spec — seul le chemin retenu produit du code.

**Tech Stack:** Next.js 16, @sentry/nextjs 10.x, pg Pool + @vercel/functions, Vercel (Fluid Compute).

**Spec:** `docs/superpowers/specs/2026-07-13-sentry-fiabilite-design.md`

**Ordre:** Task 0 (branche) → Task 1 (#105) → Task 2 (#103) → Task 3 (#104). Le bruit est coupé d'abord, l'investigation vient en dernier.

**Convention projet:** pas d'attribution Claude dans les commits. `bun run check` = prettier + tsc + eslint, doit passer avant chaque commit.

---

### Task 0: Branche de campagne + spec/plan committés

**Files:** aucun changement de code.

- [ ] **Step 1: Créer la branche depuis main à jour**

```bash
git checkout main && git pull && git checkout -b fix/sentry-fiabilite
```

- [ ] **Step 2: Committer le spec et le plan**

```bash
git add docs/superpowers/specs/2026-07-13-sentry-fiabilite-design.md docs/superpowers/plans/2026-07-13-sentry-fiabilite.md
git commit -m "docs: spec + plan campagne fiabilité Sentry (#103 #104 #105)"
```

---

### Task 1: #105 — Gate d'environnement Sentry (dev coupé, previews conservées)

**Files:**

- Modify: `instrumentation-client.ts`
- Modify: `sentry.server.config.ts`
- Modify: `sentry.edge.config.ts`
- Modify: `playwright.config.ts` (kill-switch pour le chemin e2e CI qui force `NODE_ENV=production`)

Pas de test unitaire (config d'init SDK, aucun point d'accroche testable sans mocker `Sentry.init` pour rien). Vérification = build + comportement en dev.

- [ ] **Step 1: Vérifier que `NEXT_PUBLIC_VERCEL_ENV` sera disponible**

Sur Vercel, `NEXT_PUBLIC_VERCEL_ENV` n'existe que si « Automatically expose System Environment Variables » est actif. **`vercel env ls` ne peut PAS répondre** (il liste les variables du projet, pas les variables système ni le toggle). Vérifier en lecture seule via l'API :

```bash
vercel api "/v9/projects/nomaqbanq" 2>&1 | grep -o '"autoExposeSystemEnvs":[a-z]*'
```

Expected: `"autoExposeSystemEnvs":true`. (Si le slug du projet diffère, le prendre dans `.vercel/project.json`.) Si `false` : l'activer dans le dashboard (Settings → Environment Variables → « Automatically expose System Environment Variables »). Ne PAS créer la variable à la main. Si non activable immédiatement, continuer quand même : le fallback `?? "production"` du Step 2 couvre l'intervalle (dégradé accepté par le spec).

- [ ] **Step 2: Modifier `instrumentation-client.ts`**

Ajouter `enabled` et `environment` en tête d'options de `Sentry.init` (le reste du fichier ne change pas) :

```ts
Sentry.init({
  dsn: "https://c7c726531f3e9dc07a6488f3bd7ae9b4@o4510410010787842.ingest.us.sentry.io/4510410016227333",

  // Dev local et e2e (y compris le build prod du chemin CI, via le kill-switch)
  // ne doivent jamais polluer le projet Sentry de prod.
  enabled:
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SENTRY_DISABLED !== "1",
  // VERCEL_ENV n'existe pas dans le bundle navigateur ; fallback "production"
  // (et pas "development") : `enabled` garantit déjà qu'on est en build prod.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production",

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  // ... (tracesSampleRate, enableLogs, replays*, sendDefaultPii inchangés)
})
```

- [ ] **Step 3: Modifier `sentry.server.config.ts`**

```ts
Sentry.init({
  dsn: "https://c7c726531f3e9dc07a6488f3bd7ae9b4@o4510410010787842.ingest.us.sentry.io/4510410016227333",

  // Dev local et e2e (y compris le build prod du chemin CI, via le kill-switch)
  // ne doivent jamais polluer le projet Sentry de prod.
  enabled:
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SENTRY_DISABLED !== "1",
  environment: process.env.VERCEL_ENV ?? "development",

  // ... (tracesSampleRate, enableLogs, sendDefaultPii inchangés)
})
```

- [ ] **Step 4: Modifier `sentry.edge.config.ts` et `playwright.config.ts`**

`sentry.edge.config.ts` : mêmes deux options que le serveur (`enabled` avec kill-switch, `environment: process.env.VERCEL_ENV ?? "development"`).

`playwright.config.ts` — poser le kill-switch dans `webServer.env` (le build CI `bun run build && bun run start` inline la variable dans le bundle client ; serveur/edge la lisent au runtime) :

```ts
  webServer: {
    command: process.env.CI
      ? "bun run build && bun run start"
      : "bun dev --turbopack",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: process.env.CI ? "production" : "development",
      // Le chemin CI tourne en build production : sans ce kill-switch, le DSN
      // hardcodé enverrait le bruit HeadlessChrome dans le projet Sentry de prod.
      NEXT_PUBLIC_SENTRY_DISABLED: "1",
    },
  },
```

- [ ] **Step 5: Gates**

```bash
bun run check && bun run build
```

Expected: les trois passent. Si `bun run build` échoue sur autre chose que ces fichiers (cache), `rm -rf .next` puis relancer.

- [ ] **Step 6: Vérification comportementale en dev**

Demander à l'utilisateur de lancer `bun dev` (JAMAIS le lancer soi-même — règle projet), puis charger une page et confirmer dans la sortie réseau du navigateur qu'aucune requête ne part vers `/monitoring` ni `*.ingest.us.sentry.io`. Alternative sans serveur : accepté de s'appuyer sur la sémantique documentée de `enabled` + la vérification post-déploiement (plus d'événements `::1` dans Sentry).

- [ ] **Step 7: Commit**

```bash
git add instrumentation-client.ts sentry.server.config.ts sentry.edge.config.ts playwright.config.ts
git commit -m "chore: gate Sentry hors production + tag environment (closes #105)"
```

---

### Task 2: #103 — Handler d'erreur sur le Pool pg

**Files:**

- Modify: `db/index.ts`

Pas de test dédié (câblage d'infra sur le cycle de vie du pool ; la seule assertion utile — « un listener error existe » — testerait l'implémentation, pas un comportement). Vérification post-déploiement : NOMAQBANQ-Z ne se rouvre pas.

- [ ] **Step 1: Ajouter le handler dans `db/index.ts`**

Fichier complet après modification :

```ts
import { attachDatabasePool } from "@vercel/functions"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "@/lib/env/server"
import * as schema from "./schema"

// One pool created at module scope, reused across requests (Vercel Fluid Compute).
// Use the POOLED (-pooler) connection string for the runtime.
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 })

// Sans listener, une connexion idle coupée par Neon (reprise d'instance, reset
// réseau) émet `error` sur le pool → uncaughtException fatale. Le pool remplace
// le client mort tout seul ; il n'y a rien d'autre à faire que ne pas crasher.
pool.on("error", (err) => {
  console.warn("[pg pool] connexion idle perdue", err.message)
})

// On Vercel, let the runtime drain idle connections before suspending an instance.
if (process.env.VERCEL) attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
export type Db = typeof db
```

- [ ] **Step 2: Gates**

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add db/index.ts
git commit -m "fix: ne plus crasher sur la perte d'une connexion idle du pool pg (closes #103)"
```

---

### Task 3: #104 — Investigation crash $RS/hydratation, puis chemin B1, B2 ou B3

**Files (selon le chemin retenu en Phase B):**

- B1 : le(s) composant(s) fautif(s) identifié(s) en Phase A (+ test si code applicatif)
- B2 : Modify: `instrumentation-client.ts` + Modify: `.claude/rules/data-layer.md`
- B3 : Modify: `instrumentation-client.ts` (contexte de diagnostic uniquement)

**Phase A — Investigation (timebox ~30-45 min, s'arrêter au premier verdict net)**

- [ ] **Step A1: Inspecter les 3 événements Sentry (tags, navigateurs, releases)**

```bash
sentry issue events NOMAQBANQ-14
sentry event list NOMAQBANQ-14 --json 2>/dev/null | head -c 8000
```

Chercher : diversité des navigateurs/OS (3 users différents ?), présence systématique du breadcrumb React #418, tout marqueur de traduction ou d'app embarquée (user-agent WebView, `wv`, versions Chrome).

- [ ] **Step A2: Visionner le replay**

```bash
sentry replay view b57925147b3a45a082f677685fb780dc --web
```

(`--web` ouvre le navigateur — le rendu replay n'est pas exploitable en CLI ; la forme courte `-w` n'est pas documentée sur cette sous-commande.) Observer : la page traduite ou non, le moment du crash (pendant le streaming initial vs navigation), toute UI tierce visible.

- [ ] **Step A3: Audit d'hydratation de l'arbre rendu**

Périmètre = **tout l'arbre réellement rendu par la page**, pas seulement les fichiers au nom évocateur : `components/quiz/results/**`, la page, layout `(dashboard)` + sidebar/shell partagés, ET les sous-arbres importés par `SessionResults` — `components/quiz/question-card/` (la 1re question est dépliée par défaut → rendue côté serveur), `components/quiz/session/` (SessionToolbar), `hooks/`.

```bash
# suspects classiques dans le périmètre
grep -rnE "toLocaleString\(\)|toLocaleDateString\(\)|toLocaleTimeString\(\)|new Date\(\)|Date\.now\(\)|Math\.random\(\)|typeof window|useId|crypto\.randomUUID" \
  components/quiz/results components/quiz/question-card components/quiz/session hooks \
  "app/(dashboard)/tableau-de-bord/entrainement/[sessionId]/resultats" "app/(dashboard)/layout.tsx" components/shared 2>/dev/null
```

(Le pré-audit du design + la revue adversariale ont blanchi `components/quiz/results/**`, la page, `question-card/`, `session/` et `use-is-visible` — re-dérouler quand même le grep complet avant de conclure. Hit attendu et hors sujet : `components/shared/payments/access-badge.tsx` a un `Date.now()` — composant paiements, hors arbre résultats.) Chercher aussi : rendu conditionnel sur media query au premier render, props sérialisées différemment (undefined vs absent).

- [ ] **Step A4: Tentative de repro navigateur (skill playwright-cli / e2e-scenario)**

Contre un serveur lancé par l'utilisateur (lui demander le port — ne jamais lancer soi-même) : ouvrir `/tableau-de-bord/entrainement/<sessionId>/resultats` d'une session terminée (compte e2e existant), en émulation mobile, puis muter le DOM pendant le streaming pour simuler un tiers (dans la console : remplacer des text nodes pendant le chargement, ou activer la traduction de page si l'environnement le permet). Vérifier si `$RS` crash de la même façon.

- [ ] **Step A5: Verdict**

Choisir LE chemin : B1 (mismatch réel reproduit/identifié), B2 (mutation tierce confirmée ou fortement probable — ex. replay montrant la page traduite/altérée), B3 (rien de net). En cas de doute entre B2 et B3 → B3 (le spec interdit le filtre sans confirmation).

**Phase B1 — Mismatch réel** (seulement si verdict B1)

- [ ] **Step B1-1: Écrire le test qui échoue** — test de rendu du composant fautif reproduisant le mismatch (la forme exacte dépend du composant identifié ; suivre le pattern des tests existants dans `tests/`, happy-dom). Run: `bun run test -- <fichier>` → FAIL attendu.
- [ ] **Step B1-2: Fix ciblé** du composant (ex. locale explicite `fr-CA`, extraction de l'horloge au scope module, alignement serveur/client du rendu conditionnel).
- [ ] **Step B1-3: Tests + gates** — `bun run test -- <fichier>` PASS puis `bun run check`.
- [ ] **Step B1-4: Commit**

```bash
git add <fichiers>
git commit -m "fix: mismatch d'hydratation sur la page résultats d'entraînement (closes #104)"
```

**Phase B2 — Bruit tiers confirmé** (seulement si verdict B2)

- [ ] **Step B2-1: Filtre `beforeSend` étroit dans `instrumentation-client.ts`**

Ajouter au `Sentry.init` client (double condition message ET frame `$RS` — ne JAMAIS élargir) :

```ts
  // Un tiers (traduction/extension) qui mute le DOM pendant le streaming fait
  // crasher le script inline $RS de React avec ce message précis — pas un bug
  // applicatif. Double condition volontairement étroite : ne jamais l'élargir
  // sans audit d'hydratation préalable.
  beforeSend(event, hint) {
    const error = hint.originalException
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? []
    if (
      error instanceof TypeError &&
      error.message.includes("reading 'parentNode'") &&
      frames.some((f) => f.function === "$RS")
    ) {
      return null
    }
    return event
  },
```

- [ ] **Step B2-2: Documenter dans `.claude/rules/data-layer.md`** — ajouter une puce à la section Hydration existante : les erreurs `$RS`/`parentNode` d'origine tierce sont filtrées dans `instrumentation-client.ts` ; toute nouvelle erreur d'hydratation doit d'abord être auditée avant d'envisager d'étendre le filtre.
- [ ] **Step B2-3: Gates** — `bun run check`.
- [ ] **Step B2-4: Commit + clôture**

```bash
git add instrumentation-client.ts .claude/rules/data-layer.md
git commit -m "chore: filtre le crash \$RS causé par la mutation tierce du DOM (closes #104)"
sentry issue archive NOMAQBANQ-14
```

**Phase B3 — Non concluant** (seulement si verdict B3)

- [ ] **Step B3-1: Contexte de diagnostic** — dans `instrumentation-client.ts`, ajouter le tag identifié comme discriminant en Phase A. Défaut raisonnable : marqueur de traduction du document au moment de l'erreur :

```ts
  beforeSend(event) {
    // Marqueurs de traduction/mutation tierce du document : permettent de trier
    // les erreurs d'hydratation « vrai bug » vs « DOM altéré par un tiers ».
    event.tags = {
      ...event.tags,
      "document.lang": document.documentElement.lang || "(vide)",
      "document.translated":
        document.documentElement.classList.contains("translated-ltr") ||
        document.documentElement.classList.contains("translated-rtl"),
    }
    return event
  },
```

- [ ] **Step B3-2: Gates + commit**

```bash
bun run check
git add instrumentation-client.ts
git commit -m "chore: tags de diagnostic pour le crash \$RS de la page résultats (#104)"
```

- [ ] **Step B3-3: Consigner dans l'issue GitHub** (reste ouverte) :

```bash
gh issue comment 104 --body "Investigation du 2026-07-13 : <résumé des constats A1-A4>. Non concluant — tags de diagnostic ajoutés (document.lang, document.translated), on statue au prochain événement."
```

**Clôture Task 3 (tous chemins)**

- [ ] **Step C1: Commenter l'issue #104 avec le verdict et le chemin pris** (B1/B2 : le commit référencé la ferme au merge ; B3 : commentaire du Step B3-3).

---

### Task 4: Finalisation

- [ ] **Step 1: Suite complète + gates**

```bash
bun run check && bun run test:coverage
```

Expected: PASS (`bun run test` seul ne mesure pas la couverture — le seuil CI n'est appliqué que par `test:coverage`).

- [ ] **Step 2: Push + PR**

```bash
git push -u origin fix/sentry-fiabilite
gh pr create --title "fix: fiabilité Sentry — pool pg, gate d'environnement, crash \$RS résultats (#103 #104 #105)" --body "<résumé des 3 commits + verdict investigation #104>"
```

Inclure dans le corps de la PR la clé de lecture post-déploiement du résiduel #103 : `pool.on("error")` couvre le cas idle (celui de NOMAQBANQ-Z) ; un client checked-out pendant `db.transaction` reste un chemin d'uncaughtException distinct — si l'issue Sentry se rouvre avec une stack transactionnelle, c'est ce chemin-là, pas un échec du fix.

- [ ] **Step 3: Vérifications post-déploiement (à tracer dans la PR)** — plus d'événements `::1`/localhost dans Sentry ; événements tagués `environment` ; NOMAQBANQ-Z ne se rouvre pas ; NOMAQBANQ-14 selon le chemin (résolue / archivée / en observation).
