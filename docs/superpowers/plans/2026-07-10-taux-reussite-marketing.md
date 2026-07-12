# Taux de réussite marketing honnête et centralisé (#84 + #85) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortir les claims éditoriaux (`85%`, `4.9/5`) du DAL et du JSX vers une constante unique, puis rendre `successRate` réellement calculé sur les participations d'examens (seuil de volume + plancher de publication).

**Architecture:** Une constante `MARKETING_CLAIMS` (`constants/index.tsx`) comme source éditoriale unique. Une fonction pure `resolveSuccessRate` (`features/marketing/lib.ts`, unit-testable) décide entre taux calculé et repli éditorial. `getMarketingStats` ajoute UNE requête agrégée (`count(*) filter`) et applique `resolveSuccessRate` ; `rating` sort du type `MarketingStats`. Tous les affichages lisent la constante ou `stats.successRate`.

**Tech Stack:** Drizzle/Neon (agrégat SQL), React (Server Components + hook client), Vitest (unit happy-dom + intégration Neon éphémère).

**Spec:** `docs/superpowers/specs/2026-07-10-taux-reussite-marketing-design.md`

**Rappels projet :** commits conventionnels SANS attribution Claude ; `bun run test` (JAMAIS `bun test`) ; ne jamais lancer `bun dev` soi-même. **On EMPILE sur la branche existante `fix/91-quiz-public-answer-key` (PR #96) — PAS de nouvelle branche.** Ordre imposé par les issues : #84 (centralisation) AVANT #85 (calcul), sinon conflits.

---

### Task 1: Constante éditoriale `MARKETING_CLAIMS` (#84)

**Files:**

- Modify: `constants/index.tsx` (append)

- [ ] **Step 1: Ajouter la constante**

À la fin de `constants/index.tsx` :

```ts
/**
 * Claims marketing ÉDITORIAUX (non calculés). `successRate` sert de repli quand
 * le vrai taux (features/marketing/dal.ts) n'est pas publiable (volume ou
 * plancher). `rating` reste 100 % éditorial : aucun système d'avis en base.
 */
export const MARKETING_CLAIMS = {
  successRate: "85%",
  rating: "4.9/5",
} as const
```

- [ ] **Step 2: Vérifier la compile**

Run: `bun run check`
Expected: PASS (constante non encore consommée — pas d'erreur unused sur un export).

- [ ] **Step 3: Commit**

```bash
git add constants/index.tsx
git commit -m "feat: constante MARKETING_CLAIMS (claims editoriaux centralises) (#84)"
```

---

### Task 2: `resolveSuccessRate` + seuils (unit, RED → GREEN) (#85)

**Files:**

- Create: `tests/marketing/success-rate.test.ts`
- Create: `features/marketing/lib.ts`

- [ ] **Step 1: Écrire le test unitaire (rouge)**

`features/marketing/lib.ts` ne touche pas `db` → testable en happy-dom sans mock DB. On importe la vraie constante pour ne pas figer une copie.

```ts
import { describe, expect, it } from "vitest"
import { MARKETING_CLAIMS } from "@/constants"
import {
  MIN_COMPLETED_PARTICIPATIONS,
  MIN_PUBLISHABLE_SUCCESS_RATE,
  SUCCESS_SCORE_THRESHOLD,
  resolveSuccessRate,
} from "@/features/marketing/lib"

const EDITORIAL = MARKETING_CLAIMS.successRate

describe("resolveSuccessRate", () => {
  it("retombe sur l'éditorial sous le seuil de volume", () => {
    expect(resolveSuccessRate({ completed: 49, passed: 49 })).toBe(EDITORIAL)
  })

  it("retombe sur l'éditorial à 0 participation (pas de division par zéro)", () => {
    expect(resolveSuccessRate({ completed: 0, passed: 0 })).toBe(EDITORIAL)
  })

  it("publie le taux calculé au seuil exact de volume si ≥ plancher", () => {
    // 50 terminées, 40 réussies → 80 % ≥ 70 % → publié.
    expect(resolveSuccessRate({ completed: 50, passed: 40 })).toBe("80%")
  })

  it("retombe sur l'éditorial quand le taux est sous le plancher de publication", () => {
    // 100 terminées, 42 réussies → 42 % < 70 % → éditorial.
    expect(resolveSuccessRate({ completed: 100, passed: 42 })).toBe(EDITORIAL)
  })

  it("publie exactement au plancher (70 %) mais pas juste en dessous (69 %)", () => {
    expect(resolveSuccessRate({ completed: 100, passed: 70 })).toBe("70%")
    expect(resolveSuccessRate({ completed: 100, passed: 69 })).toBe(EDITORIAL)
  })

  it("arrondit le taux (Math.round)", () => {
    // 60 terminées, 47 réussies → 78,33 % → 78 %.
    expect(resolveSuccessRate({ completed: 60, passed: 47 })).toBe("78%")
  })

  it("expose des seuils cohérents avec la spec", () => {
    expect(SUCCESS_SCORE_THRESHOLD).toBe(60)
    expect(MIN_COMPLETED_PARTICIPATIONS).toBe(50)
    expect(MIN_PUBLISHABLE_SUCCESS_RATE).toBe(70)
  })
})
```

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test -- success-rate`
Expected: FAIL — module `@/features/marketing/lib` introuvable.

- [ ] **Step 3: Écrire le module**

```ts
import { MARKETING_CLAIMS } from "@/constants"

// Score (%) minimal d'une participation « réussie ».
export const SUCCESS_SCORE_THRESHOLD = 60
// Volume minimal de participations terminées pour publier un taux calculé.
export const MIN_COMPLETED_PARTICIPATIONS = 50
// Plancher marketing : sous ce taux, on garde le claim éditorial (page de vente).
export const MIN_PUBLISHABLE_SUCCESS_RATE = 70

/**
 * Décide de la valeur affichée : le taux calculé arrondi, OU le claim éditorial
 * si le volume est insuffisant OU si le taux est sous le plancher de publication.
 */
export const resolveSuccessRate = ({
  completed,
  passed,
}: {
  completed: number
  passed: number
}): string => {
  if (completed < MIN_COMPLETED_PARTICIPATIONS) {
    return MARKETING_CLAIMS.successRate
  }
  const rate = Math.round((passed / completed) * 100)
  if (rate < MIN_PUBLISHABLE_SUCCESS_RATE) {
    return MARKETING_CLAIMS.successRate
  }
  return `${rate}%`
}
```

- [ ] **Step 4: Vérifier le vert + gates**

Run: `bun run test -- success-rate` puis `bun run check`
Expected: PASS (7 tests) ; check PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/marketing/success-rate.test.ts features/marketing/lib.ts
git commit -m "feat: resolveSuccessRate + seuils (bascule calcul/editorial) (#85)"
```

---

### Task 3: DAL — agrégat + calcul, `rating` retiré (intégration, RED → GREEN) (#85 + #84)

**Files:**

- Create: `tests/integration/marketing-dal.test.ts`
- Modify: `features/marketing/dal.ts`
- Modify: `tests/hooks/useMarketingStats.test.tsx` (mock sans `rating`)

- [ ] **Step 1: Écrire le test d'intégration (rouge)**

`exam_participations` est partagée entre fichiers de test → **delta-vs-baseline** :
lire la baseline agrégée, insérer des participations connues (1 examen + N users
distincts, contrainte `UNIQUE(examId, userId)`), assert le delta. `getMarketingStats`
est `cache()`-isé (React) → mocker `react` `cache` en passthrough comme les autres
tests DAL.

```ts
import { eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { examParticipations, exams, user } from "@/db/schema"
import { getMarketingStats } from "@/features/marketing/dal"
import {
  MIN_COMPLETED_PARTICIPATIONS,
  SUCCESS_SCORE_THRESHOLD,
  resolveSuccessRate,
} from "@/features/marketing/lib"
import { createId } from "@/lib/ids"

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const suffix = createId().slice(0, 8)
const examId = createId()
const creatorId = createId()
// Assez de participations pour franchir le seuil de volume à coup sûr, toutes
// réussies (score ≥ seuil) → delta 100 % réussite ; combiné à la baseline, le
// total dépasse MIN_COMPLETED_PARTICIPATIONS.
const N = MIN_COMPLETED_PARTICIPATIONS + 10
const userIds = Array.from({ length: N }, () => createId())

const baselineAgg = async () => {
  const [row] = await db
    .select({
      completed:
        sql<number>`count(*) filter (where status in ('completed','auto_submitted'))`.mapWith(
          Number,
        ),
      passed:
        sql<number>`count(*) filter (where status in ('completed','auto_submitted') and score >= ${SUCCESS_SCORE_THRESHOLD})`.mapWith(
          Number,
        ),
    })
    .from(examParticipations)
  return row ?? { completed: 0, passed: 0 }
}

beforeAll(async () => {
  await db.insert(user).values({
    id: creatorId,
    name: "Créateur Marketing",
    email: `mktg-${suffix}@test.invalid`,
    emailVerified: true,
  })
  await db.insert(exams).values({
    id: examId,
    title: `Examen marketing ${suffix}`,
    startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
    endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    completionTime: 3600,
    createdBy: creatorId,
  })
  await db.insert(user).values(
    userIds.map((id, i) => ({
      id,
      name: `Participant ${i}`,
      email: `mktg-p-${i}-${suffix}@test.invalid`,
      emailVerified: true,
    })),
  )
  await db.insert(examParticipations).values(
    userIds.map((uid) => ({
      examId,
      userId: uid,
      status: "completed" as const,
      score: 90, // ≥ SUCCESS_SCORE_THRESHOLD → réussite
      completedAt: new Date(),
    })),
  )
})

afterAll(async () => {
  await db.delete(exams).where(eq(exams.id, examId)) // cascade participations
  await db.delete(user).where(inArray(user.id, [creatorId, ...userIds]))
})

describe("getMarketingStats — successRate calculé", () => {
  it("ne renvoie plus le champ rating", async () => {
    const stats = await getMarketingStats()
    expect(stats).not.toHaveProperty("rating")
  })

  it("câble l'agrégat SQL sur resolveSuccessRate (oracle exact, baseline develop quelconque)", async () => {
    // La branche de test est clonée de develop (scripts/neon-api.ts), donc la
    // baseline n'est JAMAIS vide : l'oracle recalcule l'agrégat indépendamment
    // et exige l'égalité avec la bascule — exact quelle que soit la baseline
    // (revue design 2026-07-12, constat #1 : l'ancien if/else était tautologique
    // dans sa branche else).
    const agg = await baselineAgg()
    const stats = await getMarketingStats()
    expect(stats.successRate).toBe(resolveSuccessRate(agg))
    // Nos N insertions garantissent le franchissement du seuil de volume.
    expect(agg.completed).toBeGreaterThanOrEqual(MIN_COMPLETED_PARTICIPATIONS)
  })
})
```

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test:integration`
Expected: FAIL — le RED **déterministe** est le test `rating` (« ne renvoie plus
rating » échoue tant que le champ existe). Le test d'oracle exact échoue AUSSI
dès que `resolveSuccessRate(agg) ≠ "85%"` (taux réel ≥ 70 % différent de 85) —
mais ne compte pas comme seul témoin du rouge. Le reste de la suite reste vert.

(Coût : ~90-120 s par run Neon. 1 RED + 1 GREEN suffisent.)

- [ ] **Step 3: Modifier le DAL**

Dans `features/marketing/dal.ts` :

Imports — ajouter `examParticipations` et le lib :

```ts
import { examParticipations, questions, user } from "@/db/schema"
import { SUCCESS_SCORE_THRESHOLD, resolveSuccessRate } from "./lib"
```

(l'import drizzle `isNull, sql` existe déjà.)

Retirer `rating` du type (`successRate` RESTE, il devient calculé) :

```ts
export type MarketingStats = {
  totalQuestions: string
  totalUsers: string
  totalDomains: number
  successRate: string
  topDomains: { domain: string; count: number }[]
}
```

(`successRate` RESTE — il devient calculé ; seul `rating` disparaît.)

Après le `count(*)` users, ajouter l'agrégat participations :

```ts
// Pas de jointure user : les participations de comptes soft-deleted COMPTENT
// (un passage d'examen réel reste un point de donnée du taux — on mesure des
// passages, pas des comptes actifs ; décision revue design 2026-07-12).
const [participationAgg] = await db
  .select({
    completed:
      sql<number>`count(*) filter (where ${examParticipations.status} in ('completed','auto_submitted'))`.mapWith(
        Number,
      ),
    passed:
      sql<number>`count(*) filter (where ${examParticipations.status} in ('completed','auto_submitted') and ${examParticipations.score} >= ${SUCCESS_SCORE_THRESHOLD})`.mapWith(
        Number,
      ),
  })
  .from(examParticipations)
```

Remplacer le `return` :

```ts
return {
  totalQuestions: formatMarketingStat(totalQuestions),
  totalUsers: formatMarketingStat(users?.n ?? 0),
  totalDomains: domainRows.length,
  successRate: resolveSuccessRate({
    completed: participationAgg?.completed ?? 0,
    passed: participationAgg?.passed ?? 0,
  }),
  topDomains: domainRows.slice(0, 10).map((r) => ({
    domain: r.domain,
    count: r.count,
  })),
}
```

- [ ] **Step 4: Mettre à jour le mock du hook**

Dans `tests/hooks/useMarketingStats.test.tsx`, retirer `rating: "4.9/5",` de `mockStats` (l.19). Vérifier qu'aucun autre test ne construit un `MarketingStats` complet :

Run: `grep -rn "rating:" tests/`
Expected: plus aucune ligne (hors ce fichier, déjà corrigé).

- [ ] **Step 5: Vérifier le vert + gates**

Run: `bun run test:integration` puis `bun run check && bun run test`
Expected: PASS partout.

- [ ] **Step 6: Commit**

```bash
git add features/marketing/dal.ts tests/integration/marketing-dal.test.ts tests/hooks/useMarketingStats.test.tsx
git commit -m "feat: successRate calcule sur les participations + retrait de rating du DAL (#85)"
```

---

### Task 4: Points d'affichage lisent la source centralisée (#84)

**Files:**

- Modify: `app/(marketing)/tarifs/_components/pricing-header.tsx`
- Modify: `app/(marketing)/a-propos/_components/about-story.tsx`
- Modify: `app/(marketing)/a-propos/_components/a-propos-page-client.tsx`
- Modify: `app/(marketing)/_components/home-landing.tsx`
- Modify: `app/(marketing)/a-propos/page.tsx`

Aucun changement visuel : mêmes textes, mêmes accents.

- [ ] **Step 1: `pricing-header.tsx` — `4.9/5` → constante**

Ajouter l'import : `import { MARKETING_CLAIMS } from "@/constants"`.
Remplacer le littéral `4.9/5` (l.137) par `{MARKETING_CLAIMS.rating}`.
(`successRate` y est déjà via `marketingStats?.successRate` — inchangé.)

- [ ] **Step 2: `about-story.tsx` — repli → constante**

Ajouter l'import `MARKETING_CLAIMS`. Remplacer (l.33) :

```tsx
la réussite, avec un taux de succès de {stats?.successRate ?? "85%"}{" "}
```

par :

```tsx
la réussite, avec un taux de succès de{" "}
{stats?.successRate ?? MARKETING_CLAIMS.successRate}{" "}
```

- [ ] **Step 3: `a-propos-page-client.tsx` — brancher le hook**

Le composant est `"use client"` mais ne consomme pas encore les stats. Ajouter :

```ts
import { MARKETING_CLAIMS } from "@/constants"
import { useMarketingStats } from "@/hooks/useMarketingStats"
```

Dans le corps du composant, récupérer les stats :

```ts
const { stats } = useMarketingStats()
```

Remplacer le littéral `85% de réussite` (l.58) par :

```tsx
{stats?.successRate ?? MARKETING_CLAIMS.successRate} de réussite
```

- [ ] **Step 4: `home-landing.tsx` — littéraux → source**

Ajouter l'import `MARKETING_CLAIMS` (le composant consomme déjà `useMarketingStats`, `stats` est en scope).
Remplacer `85% de réussite` (l.212) par `{stats?.successRate ?? MARKETING_CLAIMS.successRate} de réussite`.
Remplacer `4.9/5` (l.225) par `{MARKETING_CLAIMS.rating}`.

- [ ] **Step 5: `a-propos/page.tsx` — metadata SEO → constante**

Ajouter l'import `MARKETING_CLAIMS`. Les `metadata` étant un objet statique
exporté, interpoler la constante dans les deux descriptions (l.7 et l.17) :

```ts
description: `Découvrez NOMAQbanq : notre mission, notre équipe et notre engagement envers la communauté médicale francophone. ${MARKETING_CLAIMS.successRate} de taux de réussite, des milliers de candidats accompagnés.`,
```

et

```ts
description: `Notre mission : accompagner les médecins francophones vers la réussite à l'EACMC. ${MARKETING_CLAIMS.successRate} de taux de réussite, des milliers de candidats satisfaits.`,
```

- [ ] **Step 6: Vérifier les critères d'acceptation grep + gates**

```bash
grep -rn "85%" app features
grep -rn "4\.9/5" app features
```

Expected : **zéro** match dans `app`/`features` (la constante vit dans
`constants/`, hors périmètre). Motif `4\.9/5` et NON `4\.9` : les paths SVG du
logo Google dans `app/(auth)` contiennent « 14.97 » qui matche `4\.9` — ne PAS
« corriger » ces SVG (revue design 2026-07-12, constat #2). Un reliquat
`85%`/`4.9/5` en dur = à corriger.

Run: `bun run check && bun run test`
Expected: PASS partout.

- [ ] **Step 7: Vérification navigateur (par l'utilisateur)**

Demander à l'utilisateur : `bun dev` → `/`, `/tarifs`, `/a-propos` → les
chiffres s'affichent identiques (taux = éditorial `85%` tant que < 50
participations réussies en dev, `4.9/5` partout). NE PAS lancer `bun dev` soi-même.

- [ ] **Step 8: Commit**

```bash
git add "app/(marketing)"
git commit -m "refactor: les affichages marketing lisent MARKETING_CLAIMS / stats.successRate (#84)"
```

---

### Task 5: Gates finaux

- [ ] **Step 1: Suite complète**

Run: `bun run check && bun run test && bun run test:integration`
Expected: PASS partout.

- [ ] **Step 2: Formater + committer la spec/plan si retouchés**

```bash
bunx prettier --write docs/superpowers/specs/2026-07-10-taux-reussite-marketing-design.md docs/superpowers/plans/2026-07-10-taux-reussite-marketing.md
git add docs/superpowers
git commit -m "docs: spec + plan taux de reussite marketing (#84 #85)"
```

---

## Hors scope (rappel spec)

Vrai système d'avis pour `rating` (pas de table), `4.9/5` du carrousel de
témoignages (données fictives par témoignage), tout changement visuel. Ne rien
implémenter de tout ça.
