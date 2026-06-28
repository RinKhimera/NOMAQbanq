# Sync des env de dev depuis Vercel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruire `.env.local` à l'identique (et rangé par sections) sur n'importe quel PC via `bun run env:sync`, depuis le scope **Development** de Vercel, sans jamais toucher preview/prod.

**Architecture:** Le scope `Development` de Vercel devient la source de vérité unique et un **sur-ensemble** de `.env.local`. Un script d'amorçage unique y pousse les 13 clés locales encore absentes (en `development` seulement). Un wrapper `scripts/sync-env.ts` fait `vercel env pull` puis **regroupe** le fichier plat en sections (fonctionnel + tag de tier 🟢/🟡), avec un **garde-fou anti-écrasement** (refuse d'écraser si des clés locales manquent côté Vercel).

**Tech Stack:** Bun (exécute le TS directement), `dotenv` (parse des valeurs), `node:child_process` (spawn de la CLI Vercel v54.x), Vitest (tests des fonctions pures). Spec : `docs/superpowers/specs/2026-06-27-sync-env-dev-vercel-design.md`.

**⚠️ Ordre critique d'exécution :** construire les scripts (Tasks 1-5) → **amorcer Vercel** (Task 6) → **seulement ensuite** lancer `bun run env:sync` (Task 7). Lancer le sync avant l'amorçage effacerait les 12 clés locales absentes de Vercel (le garde-fou de Task 2 le bloque, mais l'ordre reste impératif).

---

## File Structure

- **Create** `scripts/sync-env.ts` — pull `development` + regroupement en sections + garde-fou anti-écrasement. Exporte les fonctions pures `parseRawLines`, `groupEnv`, `keysOnlyIn` ; `main()` gardé (non exécuté à l'import).
- **Create** `scripts/seed-vercel-dev-env.ts` — amorçage unique des clés locales absentes de Vercel Dev. Exporte la fonction pure `keysToSeed` ; `main()` gardé.
- **Create** `tests/scripts/sync-env.test.ts` — tests unitaires de `groupEnv` / `parseRawLines` / `keysOnlyIn`.
- **Create** `tests/scripts/seed-vercel-dev-env.test.ts` — tests unitaires de `keysToSeed`.
- **Modify** `package.json:21` — ajouter le script `"env:sync"`.
- **Modify** `README.md` — sous-section « Sync env from Vercel » (Installation) + entrée dans « Available Scripts ».
- **Modify** `.env.local` (gitignored, jamais commité) — ajouter `EMAIL_OVERRIDE_TO=dixiades@gmail.com` avant l'amorçage.

Convention respectée (cf. `scripts/neon-api.ts`) : ESM, top-level guard `process.argv[1]?.endsWith("...")`, pas de shebang, lancé via `bun scripts/X.ts`.

---

## Task 1: Cœur de regroupement (`groupEnv`) — TDD

**Files:**

- Create: `scripts/sync-env.ts`
- Test: `tests/scripts/sync-env.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/scripts/sync-env.test.ts` :

```ts
import { describe, expect, it } from "vitest"
import { groupEnv, keysOnlyIn, parseRawLines } from "@/scripts/sync-env"

describe("parseRawLines", () => {
  it("ignore commentaires et lignes vides, garde la ligne brute", () => {
    const map = parseRawLines("# c\n\nDATABASE_URL=postgres://a&b=c")
    expect(map.size).toBe(1)
    expect(map.get("DATABASE_URL")).toBe("DATABASE_URL=postgres://a&b=c")
  })
})

describe("groupEnv", () => {
  it("regroupe par section, préserve la valeur brute, respecte l'ordre", () => {
    const flat = [
      'EMAIL_FROM="NOMAQbanq <noreply@nomaqbanq.ca>"',
      "DATABASE_URL=postgres://a&b=c",
      "BETTER_AUTH_SECRET=xyz",
    ].join("\n")
    const out = groupEnv(flat)
    expect(out).toContain("# === Base de données — Neon")
    expect(out).toContain("DATABASE_URL=postgres://a&b=c")
    expect(out).toContain('EMAIL_FROM="NOMAQbanq <noreply@nomaqbanq.ca>"')
    expect(out.indexOf("DATABASE_URL")).toBeLessThan(
      out.indexOf("BETTER_AUTH_SECRET"),
    )
    expect(out.indexOf("BETTER_AUTH_SECRET")).toBeLessThan(
      out.indexOf("EMAIL_FROM"),
    )
  })

  it("met les clés inconnues en « Non classé »", () => {
    const out = groupEnv("FOO_UNKNOWN=1\nDATABASE_URL=x")
    expect(out).toContain("# === Non classé")
    expect(out).toContain("FOO_UNKNOWN=1")
  })
})

describe("keysOnlyIn", () => {
  it("retourne les clés de a absentes de b, triées", () => {
    expect(keysOnlyIn(["B", "A", "C"], new Set(["A"]))).toEqual(["B", "C"])
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `bun run test -- sync-env`
Expected: FAIL — `Cannot find module '@/scripts/sync-env'`.

- [ ] **Step 3: Implémenter `scripts/sync-env.ts`**

Create `scripts/sync-env.ts` :

```ts
/**
 * Reconstruit .env.local depuis le scope « Development » de Vercel, regroupé en
 * sections (fonctionnel + tag de tier). `vercel env pull` produit un fichier
 * plat ; ce script le post-traite. Lancé via `bun run env:sync`.
 *
 * Garde-fou : si .env.local contient des clés ABSENTES du pull, on REFUSE
 * d'écraser (perte de données) — amorcer ces clés dans Vercel d'abord
 * (scripts/seed-vercel-dev-env.ts), ou forcer avec --force.
 */
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

type Group = { title: string; tier: string; keys: readonly string[] }

// Carte de groupes = point unique de catégorisation (alignée sur .env.example).
const GROUP_MAP: readonly Group[] = [
  {
    title: "Base de données — Neon",
    tier: "🟢 runtime, REQUIS",
    keys: ["DATABASE_URL", "DATABASE_URL_UNPOOLED"],
  },
  {
    title: "Better Auth",
    tier: "🟢 runtime, REQUIS",
    keys: ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"],
  },
  {
    title: "OAuth Google",
    tier: "🟢 runtime",
    keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    title: "AWS SES — emails",
    tier: "🟢 runtime",
    keys: [
      "SES_REGION",
      "SES_ACCESS_KEY_ID",
      "SES_SECRET_ACCESS_KEY",
      "EMAIL_FROM",
      "SES_CONFIGURATION_SET",
      "EMAIL_OVERRIDE_TO",
    ],
  },
  {
    title: "AWS S3 + CloudFront — médias",
    tier: "🟢 runtime",
    keys: [
      "S3_REGION",
      "S3_BUCKET",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "NEXT_PUBLIC_CDN_HOSTNAME",
    ],
  },
  { title: "Cron Vercel", tier: "🟢 runtime", keys: ["CRON_SECRET"] },
  {
    title: "Sentry — monitoring",
    tier: "🟡 build + 🟢 runtime",
    keys: ["SENTRY_AUTH_TOKEN", "NEXT_PUBLIC_SENTRY_DSN"],
  },
  {
    title: "Tests d'intégration — Neon API",
    tier: "🟡 outillage",
    keys: ["NEON_API_KEY", "NEON_PROJECT_ID"],
  },
  {
    title: "Tests E2E — Playwright",
    tier: "🟡 tests",
    keys: [
      "E2E_ADMIN_EMAIL",
      "E2E_ADMIN_PASSWORD",
      "E2E_USER_EMAIL",
      "E2E_USER_PASSWORD",
      "E2E_RESET_SECRET",
    ],
  },
  {
    title: "Vercel (auto-injecté)",
    tier: "—",
    keys: ["VERCEL_OIDC_TOKEN"],
  },
]

const HEADER =
  "# ⚠️  Généré par `bun run env:sync` — source de vérité : Vercel scope Development.\n" +
  "# Ne pas éditer à la main : toute nouvelle var doit être ajoutée sur Vercel\n" +
  "# (`vercel env add <KEY> development`), sinon le prochain sync l'efface.\n"

/** Map clé -> ligne brute (préservée telle quelle, jamais re-quotée). */
export const parseRawLines = (content: string): Map<string, string> => {
  const map = new Map<string, string>()
  for (const line of content.split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)
    if (m) map.set(m[1], line)
  }
  return map
}

/** Clés de `a` absentes de `b`, triées. */
export const keysOnlyIn = (a: Iterable<string>, b: Set<string>): string[] =>
  [...a].filter((k) => !b.has(k)).sort()

/** Regroupe le contenu plat d'un pull en sections (fonctionnel + tier). */
export const groupEnv = (content: string): string => {
  const lines = parseRawLines(content)
  const used = new Set<string>()
  const blocks: string[] = []

  for (const group of GROUP_MAP) {
    const body: string[] = []
    for (const k of group.keys) {
      const raw = lines.get(k)
      if (raw === undefined) continue
      body.push(raw)
      used.add(k)
    }
    if (body.length > 0)
      blocks.push(
        `# === ${group.title}  (${group.tier}) ===\n${body.join("\n")}`,
      )
  }

  const leftovers = [...lines.keys()].filter((k) => !used.has(k)).sort()
  if (leftovers.length > 0)
    blocks.push(
      `# === Non classé  (à ajouter à la carte de groupes) ===\n${leftovers
        .map((k) => lines.get(k) ?? "")
        .join("\n")}`,
    )

  return `${HEADER}\n${blocks.join("\n\n")}\n`
}

const main = (): void => {
  const force = process.argv.includes("--force")
  const tmp = join(mkdtempSync(join(tmpdir(), "env-sync-")), "pulled.env")

  console.log("→ vercel env pull (development)…")
  const pull = spawnSync(
    `vercel env pull "${tmp}" --environment=development --yes`,
    { shell: true, stdio: ["ignore", "inherit", "inherit"] },
  )
  if (pull.status !== 0) {
    console.error(
      "✗ `vercel env pull` a échoué. Connecté (`vercel login`) et lié (`vercel link`) ?",
    )
    process.exit(1)
  }

  const pulledContent = readFileSync(tmp, "utf8")
  rmSync(tmp, { recursive: true, force: true })
  const pulledKeys = new Set(parseRawLines(pulledContent).keys())

  if (existsSync(".env.local")) {
    const localKeys = parseRawLines(readFileSync(".env.local", "utf8")).keys()
    const wouldWipe = keysOnlyIn(localKeys, pulledKeys)
    if (wouldWipe.length > 0 && !force) {
      console.error(
        `✗ Refus d'écraser .env.local : ${wouldWipe.length} clé(s) locale(s) absente(s) de Vercel Dev seraient perdues :\n  ${wouldWipe.join(
          "\n  ",
        )}\n→ Amorce-les (\`bun scripts/seed-vercel-dev-env.ts\`) puis relance, ou force avec --force.`,
      )
      process.exit(1)
    }
  }

  writeFileSync(".env.local", groupEnv(pulledContent))

  const unclassified = keysOnlyIn(
    pulledKeys,
    new Set(GROUP_MAP.flatMap((g) => g.keys)),
  )
  console.log(`✓ .env.local régénéré : ${pulledKeys.size} variables.`)
  if (unclassified.length > 0)
    console.log(
      `ℹ ${unclassified.length} en « Non classé » : ${unclassified.join(", ")}`,
    )
}

const isDirectRun = process.argv[1]?.endsWith("sync-env.ts") ?? false
if (isDirectRun) main()
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `bun run test -- sync-env`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-env.ts tests/scripts/sync-env.test.ts
git commit -m "feat(env): script sync-env (pull + regroupement par sections)"
```

---

## Task 2: Câbler `env:sync` dans package.json

**Files:**

- Modify: `package.json:21`

- [ ] **Step 1: Ajouter le script**

Dans `package.json`, après la ligne `"generate-favicons": "bun scripts/generate-favicons.mjs",` ajouter :

```json
    "env:sync": "bun scripts/sync-env.ts",
```

- [ ] **Step 2: Vérifier que la commande est reconnue (sans l'exécuter à fond)**

Run: `bun run env:sync --help` n'existe pas ; à la place vérifier le câblage avec :
`bun pm ls >/dev/null 2>&1; grep -q '"env:sync"' package.json && echo OK`
Expected: `OK`.

> ⚠️ NE PAS lancer `bun run env:sync` maintenant : l'amorçage (Task 6) n'a pas eu lieu, le garde-fou refuserait (ou, avec --force, on perdrait des clés). Le vrai run est en Task 7.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat(env): script npm env:sync"
```

---

## Task 3: Script d'amorçage (`keysToSeed` + seed) — TDD

**Files:**

- Create: `scripts/seed-vercel-dev-env.ts`
- Test: `tests/scripts/seed-vercel-dev-env.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Create `tests/scripts/seed-vercel-dev-env.test.ts` :

```ts
import { describe, expect, it } from "vitest"
import { keysToSeed } from "@/scripts/seed-vercel-dev-env"

describe("keysToSeed", () => {
  it("retourne les clés locales absentes de Vercel, triées", () => {
    expect(keysToSeed({ B: "2", A: "1", C: "3" }, new Set(["A"]))).toEqual([
      "B",
      "C",
    ])
  })
  it("ignore les valeurs vides", () => {
    expect(keysToSeed({ X: "", Y: "v" }, new Set())).toEqual(["Y"])
  })
  it("ne retourne rien si tout est déjà présent", () => {
    expect(keysToSeed({ A: "1" }, new Set(["A"]))).toEqual([])
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `bun run test -- seed-vercel-dev-env`
Expected: FAIL — `Cannot find module '@/scripts/seed-vercel-dev-env'`.

- [ ] **Step 3: Implémenter `scripts/seed-vercel-dev-env.ts`**

Create `scripts/seed-vercel-dev-env.ts` :

```ts
/**
 * Amorçage UNIQUE : pousse dans le scope « Development » de Vercel toutes les
 * clés présentes dans .env.local mais encore absentes côté Vercel, pour que
 * `bun run env:sync` reproduise ensuite le fichier complet sur n'importe quel
 * PC. N'écrit QUE dans `development` (preview/prod jamais touchés). Idempotent.
 * Valeurs lues dans .env.local, passées par stdin (jamais en argv).
 *
 * Lancer une fois depuis le PC qui possède le .env.local complet :
 *   bun scripts/seed-vercel-dev-env.ts
 */
import { parse } from "dotenv"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseRawLines } from "./sync-env"

/** Clés à amorcer = présentes en local (valeur non vide) et absentes de Vercel. */
export const keysToSeed = (
  localValues: Record<string, string>,
  existingKeys: Set<string>,
): string[] =>
  Object.entries(localValues)
    .filter(([k, v]) => v.trim() !== "" && !existingKeys.has(k))
    .map(([k]) => k)
    .sort()

const pullExistingKeys = (): Set<string> => {
  const tmp = join(mkdtempSync(join(tmpdir(), "env-seed-")), "pulled.env")
  const res = spawnSync(
    `vercel env pull "${tmp}" --environment=development --yes`,
    { shell: true, stdio: ["ignore", "inherit", "inherit"] },
  )
  if (res.status !== 0)
    throw new Error("`vercel env pull` a échoué (login/link OK ?).")
  const keys = new Set(parseRawLines(readFileSync(tmp, "utf8")).keys())
  rmSync(tmp, { recursive: true, force: true })
  return keys
}

const addVar = (key: string, value: string): void => {
  const res = spawnSync(`vercel env add ${key} development --yes`, {
    shell: true,
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
  })
  if (res.status !== 0)
    throw new Error(`vercel env add ${key} → exit ${res.status}`)
}

const main = (): void => {
  const localValues = parse(readFileSync(".env.local", "utf8"))
  const existing = pullExistingKeys()
  const toAdd = keysToSeed(localValues, existing)

  if (toAdd.length === 0) {
    console.log(
      "✓ Rien à amorcer : Vercel Dev contient déjà toutes les clés locales.",
    )
    return
  }

  console.log(
    `→ Amorçage de ${toAdd.length} clé(s) dans Vercel Dev : ${toAdd.join(", ")}`,
  )
  for (const key of toAdd) {
    addVar(key, localValues[key])
    console.log(`  ✓ ${key}`)
  }
  console.log("✓ Amorçage terminé. Vérifie : `vercel env ls development`.")
}

const isDirectRun = process.argv[1]?.endsWith("seed-vercel-dev-env.ts") ?? false
if (isDirectRun) main()
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `bun run test -- seed-vercel-dev-env`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-vercel-dev-env.ts tests/scripts/seed-vercel-dev-env.test.ts
git commit -m "feat(env): script d'amorçage seed-vercel-dev-env"
```

---

## Task 4: Documentation README

**Files:**

- Modify: `README.md` (section « 🛠️ Installation » et « 🎨 Available Scripts »)

- [ ] **Step 1: Ajouter la sous-section de sync dans Installation**

Dans `README.md`, juste après le bloc de l'étape 3 (la ligne se terminant par `Optional: Google OAuth, AWS SES, Stripe, AWS S3, Sentry.`), insérer :

````markdown
> **Team shortcut — sync env from Vercel.** Instead of filling `.env.local` by hand, pull the shared **development** environment from Vercel on any machine:
>
> ```bash
> vercel login                 # once per machine
> vercel link                  # select team rinkhimeras-projects → project nomaqbank
> bun run env:sync             # writes a grouped .env.local from Vercel's Development scope
> ```
>
> `bun run env:sync` regenerates `.env.local` (organized into commented sections) from Vercel's `Development` scope only — preview/production are never touched. It is safe to re-run, and **refuses to overwrite** if your local file has keys not yet on Vercel (add those with `vercel env add <KEY> development`, then re-run). Re-pull at the start of a session if the Vercel OIDC token (~12 h) has expired.
````

- [ ] **Step 2: Ajouter l'entrée dans « Available Scripts »**

Dans le bloc ` ```bash ` de la section « 🎨 Available Scripts », après la ligne `bun dev                  # Start dev server with Turbopack`, insérer :

```
bun run env:sync         # Pull & regroup .env.local from Vercel (development scope)
```

- [ ] **Step 3: Vérifier le formatage**

Run: `bun run format:check`
Expected: pas d'erreur sur `README.md` (sinon `bun run format`).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(env): documente le workflow bun run env:sync"
```

---

## Task 5: Vérification globale (check) du code livré

**Files:** aucun nouveau ; corrige au besoin les 4 fichiers créés.

- [ ] **Step 1: Formatter + lint-fix**

Run: `bun run format && bun run lint:fix`
Expected: imports triés (1. `node:*` 2. `dotenv` 3. relatif `./sync-env`), aucune erreur résiduelle.

- [ ] **Step 2: Check complet**

Run: `bun run check`
Expected: PASS (prettier + tsc + eslint `--max-warnings 0`). Corriger tout type/lint sur `scripts/*.ts` et `tests/scripts/*.test.ts` jusqu'au vert.

- [ ] **Step 3: Suite de tests**

Run: `bun run test`
Expected: tous les tests passent, dont les 7 nouveaux (`tests/scripts/**`). La couverture n'est pas affectée (`scripts/**` hors `coverage.include`).

- [ ] **Step 4: Commit (si des corrections check ont eu lieu)**

```bash
git add -A
git commit -m "chore(env): format/lint des scripts env"
```

---

## Task 6: Amorçage réel de Vercel Dev (exécution, côté PC actuel)

**Files:**

- Modify: `.env.local` (gitignored — **ne sera pas commité**)

> Pré-requis : être sur le PC qui possède le `.env.local` complet, `vercel login` + lien actifs (déjà le cas : projet `nomaqbank`, team `rinkhimeras-projects`). Cette tâche **mute le scope Development de Vercel** (écritures `development` uniquement).

- [ ] **Step 1: Compléter `.env.local` avec EMAIL_OVERRIDE_TO**

Ajouter dans `.env.local`, sous le bloc AWS SES, la ligne :

```
EMAIL_OVERRIDE_TO=dixiades@gmail.com
```

- [ ] **Step 2: Lancer l'amorçage**

Run: `bun scripts/seed-vercel-dev-env.ts`
Expected (ordre des clés indifférent) :

```
→ Amorçage de 13 clé(s) dans Vercel Dev : AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_RESET_SECRET, E2E_USER_EMAIL, E2E_USER_PASSWORD, EMAIL_OVERRIDE_TO, NEON_API_KEY, NEON_PROJECT_ID, NEXT_PUBLIC_CDN_HOSTNAME, S3_BUCKET, S3_REGION
  ✓ AWS_ACCESS_KEY_ID
  ... (13 lignes ✓)
✓ Amorçage terminé. Vérifie : `vercel env ls development`.
```

> Si une ligne échoue (`vercel env add … → exit N`) : c'est probablement que la clé existe déjà (re-run partiel) — l'amorçage re-filtre les existantes au prochain run, relancer suffit.

- [ ] **Step 3: Vérifier côté Vercel**

Run: `vercel env ls development`
Expected: les 13 clés apparaissent en plus des 14 initiales (dont `S3_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_CDN_HOSTNAME`, `NEON_API_KEY`, `NEON_PROJECT_ID`, les 5 `E2E_*`, `EMAIL_OVERRIDE_TO`), toutes scopées **Development** uniquement.

---

## Task 7: Acceptation — reproduire `.env.local` via le sync

**Files:** `.env.local` (gitignored, régénéré).

- [ ] **Step 1: Sauvegarder le `.env.local` courant**

```bash
cp .env.local .env.local.bak
```

- [ ] **Step 2: Lancer le sync (le vrai, post-amorçage)**

Run: `bun run env:sync`
Expected :

```
→ vercel env pull (development)…
✓ .env.local régénéré : 28 variables.
```

(Pas de ligne « Non classé » : si elle apparaît, ajouter la/les clé(s) au `GROUP_MAP` de `scripts/sync-env.ts`.)

- [ ] **Step 3: Vérifier le regroupement et la complétude**

Run (aucune clé du backup perdue, et fichier bien sectionné) :

```bash
grep -c '^# === ' .env.local                 # > 0 : sections présentes
comm -23 \
  <(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' .env.local.bak | sort -u) \
  <(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' .env.local | sort -u)      # vide = aucune clé perdue
```

Expected : premier `> 0` ; second **vide** (toutes les clés du backup sont présentes ; le nouveau fichier ajoute en plus `CRON_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`, `VERCEL_OIDC_TOKEN`).

- [ ] **Step 4: Vérifier que l'app démarre avec le fichier régénéré**

Run: `bun run check`
Expected: PASS (l'env Zod `lib/env/schema.ts` valide : `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET` présents, refines S3/Stripe satisfaits).

Optionnel (smoke manuel) : `bun dev` démarre sans erreur d'env, puis arrêter.

- [ ] **Step 5: Nettoyer la sauvegarde**

```bash
rm .env.local.bak
```

> `.env.local` et `.env.local.bak` sont couverts par `.gitignore` (`.env*`, sauf `!.env.example`) : rien de tout cela n'est commité. Aucun secret ne quitte la machine sauf vers Vercel (déjà la source de vérité).

---

## Notes de conception

- **Le garde-fou de Task 2 remplace le « script de vérif jetable » (d) de la spec** : la sécurité anti-écrasement est désormais _intégrée et permanente_ dans `env:sync` (refus si des clés locales manquent côté Vercel, override `--force`), plutôt qu'un script à part. Le critère d'acceptation #2 de la spec (« zéro clé effaçable ») se traduit par « `bun run env:sync` réussit sans `--force` » (Task 7, Step 2-3).
- **Isolement preview/prod** : `seed` ne fait que `vercel env add <KEY> development` ; `sync` ne fait que `vercel env pull --environment=development`. Aucune commande ne cible preview/prod.
- **Secrets hors argv** : `seed` passe chaque valeur via stdin (`input`), pas via `--value`, pour ne pas exposer les secrets dans la liste des process.
- **Multiplateforme** : `spawnSync(..., { shell: true })` + chemin temp entre guillemets ; requis sous Windows pour exécuter `vercel.cmd` (Node récent bloque les `.cmd` sans `shell:true`).

---

## Self-Review

**1. Spec coverage**

- Source de vérité = Vercel Dev sur-ensemble → Tasks 1-3 + amorçage Task 6. ✅
- Amorçage des 13 clés (12 + EMAIL_OVERRIDE_TO=dixiades@gmail.com) en `development` seul → Task 6. ✅
- Wrapper `bun run env:sync` (pull + regroupement hybride fonctionnel/tier, « Non classé ») → Tasks 1-2. ✅
- Doc bootstrap README → Task 4. ✅
- Préservation des valeurs brutes (pas de re-quote) → `parseRawLines`/`groupEnv` (Task 1) + test valeur `postgres://a&b=c`. ✅
- Garde-fou anti-écrasement (remplace la vérif jetable) → Task 2 + acceptation Task 7. ✅
- Acceptation (`vercel env ls`, zéro clé effaçable, `bun run check`/`bun dev`) → Tasks 6-7. ✅
- Mortes BUNNY supprimées naturellement → régénération Task 7 (commentaires non repris). ✅

**2. Placeholder scan** : aucun TBD/TODO ; tout le code et toutes les commandes sont complets.

**3. Type/nom consistency** : `parseRawLines` (défini Task 1, réimporté Task 3), `groupEnv`, `keysOnlyIn`, `keysToSeed` — signatures cohérentes entre tasks et tests. `GROUP_MAP` interne à `sync-env.ts`. Garde `isDirectRun` identique au pattern `neon-api.ts`.
