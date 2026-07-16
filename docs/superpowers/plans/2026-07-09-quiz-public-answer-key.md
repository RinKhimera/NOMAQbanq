# Verrouillage du quiz marketing public (#91) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fermer l'oracle public de clé de réponse (`scoreQuizAnswers`) : liaison HMAC au tirage, exclusion des questions d'examens ouverts (tirage + scoring), rate-limit IP des deux actions publiques.

**Architecture:** Un jeton HMAC stateless (`features/questions/quiz-token.ts`, secret = `BETTER_AUTH_SECRET`) lie le scoring aux questions servies. Une variante anonyme du verrou d'examen (`getOpenExamQuestionIds`, `features/exams/dal.ts`) exclut les questions d'examens ouverts au tirage (SQL `NOT EXISTS`) et au scoring (re-check). Une table `quiz_rate_limits` (clé = HMAC d'IP, pas de FK) + helper `lib/quiz-rate-limit.ts` calqué sur `consumeUploadRateLimit` limite à 30/h/IP/action, purgée par le cron existant. Le client stocke le jeton et remplace le loader infini par des écrans d'erreur.

**Tech Stack:** Next.js 16 Server Actions, Drizzle/Neon, `node:crypto` (HMAC-SHA256), zod, Vitest (unit happy-dom + intégration branche Neon éphémère).

**Spec:** `docs/superpowers/specs/2026-07-09-quiz-public-answer-key-design.md`

**Rappels projet :** commits conventionnels SANS attribution Claude ; `bun run test` (JAMAIS `bun test`) ; ne jamais lancer `bun dev` soi-même (c'est l'utilisateur qui lance). La branche `fix/91-quiz-public-answer-key` est **déjà créée** depuis `main`.

**Coût des runs d'intégration :** `bun run test:integration` crée/migre/détruit une branche Neon (~90-120 s). Pour itérer, `bun run test:integration:keep` conserve la branche ; les runs RED/GREEN « officiels » de ce plan peuvent tous se faire avec la commande standard (1 RED + 1 GREEN par task suffisent).

---

### Task 0: Formater et committer les docs (sinon tous les gates sont rouges)

`bun run check` inclut `prettier --check .` : les 3 docs non formatées du
working tree (spec, plan, **et le handoff du 2026-07-08**) le font échouer
AUJOURD'HUI — aucun « Expected: PASS » des tasks suivantes n'est atteignable
avant ce commit (revue design 2026-07-09, constat #4).

- [ ] **Step 1: Formater et committer les 3 docs**

```bash
bunx prettier --write docs/superpowers/specs/2026-07-09-quiz-public-answer-key-design.md docs/superpowers/plans/2026-07-09-quiz-public-answer-key.md docs/superpowers/handoffs/2026-07-08-campagne-fix-issues-handoff.md
git add docs/superpowers/specs/2026-07-09-quiz-public-answer-key-design.md docs/superpowers/plans/2026-07-09-quiz-public-answer-key.md docs/superpowers/handoffs/2026-07-08-campagne-fix-issues-handoff.md
git commit -m "docs: spec + plan verrouillage du quiz marketing public (#91) + handoff campagne"
```

- [ ] **Step 2: Vérifier que la base est verte**

Run: `bun run check && bun run test`
Expected: PASS (baseline verte avant la première ligne de code).

---

### Task 1: Jeton HMAC `quiz-token` (unit, RED → GREEN)

**Files:**

- Create: `tests/questions/quiz-token.test.ts`
- Create: `features/questions/quiz-token.ts`

- [ ] **Step 1: Écrire le test unitaire (rouge)**

Le projet vitest `frontend` stub `server-only` (alias `vitest.config.ts:144`) mais ne pose PAS les env serveur (`vitest.setup.ts` est vide) → on mocke `@/lib/env/server`.

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { signQuizToken, verifyQuizToken } from "@/features/questions/quiz-token"

vi.mock("@/lib/env/server", () => ({
  env: { BETTER_AUTH_SECRET: "test-secret-please-change-000000000000" },
}))

afterEach(() => {
  vi.useRealTimers()
})

describe("signQuizToken / verifyQuizToken", () => {
  it("aller-retour : les ids signés sont vérifiables, insensibles à l'ordre", () => {
    const token = signQuizToken(["q-b", "q-a"])
    expect(verifyQuizToken(token)).toEqual(new Set(["q-a", "q-b"]))
  })

  it("accepte un lot vide", () => {
    expect(verifyQuizToken(signQuizToken([]))).toEqual(new Set())
  })

  it("refuse un jeton expiré (> 1 h)", () => {
    vi.useFakeTimers()
    const token = signQuizToken(["q-a"])
    vi.advanceTimersByTime(61 * 60 * 1000)
    expect(verifyQuizToken(token)).toBeNull()
  })

  it("accepte un jeton encore frais (59 min)", () => {
    vi.useFakeTimers()
    const token = signQuizToken(["q-a"])
    vi.advanceTimersByTime(59 * 60 * 1000)
    expect(verifyQuizToken(token)).toEqual(new Set(["q-a"]))
  })

  it("refuse un payload altéré (ids substitués)", () => {
    const token = signQuizToken(["q-a"])
    const [, sig] = token.split(".")
    const forged = Buffer.from(
      JSON.stringify({ v: 1, ids: ["q-volee"], exp: Date.now() + 60_000 }),
    ).toString("base64url")
    expect(verifyQuizToken(`${forged}.${sig}`)).toBeNull()
  })

  it("refuse une signature altérée", () => {
    const token = signQuizToken(["q-a"])
    const flipped = token.endsWith("A")
      ? `${token.slice(0, -1)}B`
      : `${token.slice(0, -1)}A`
    expect(verifyQuizToken(flipped)).toBeNull()
  })

  it("refuse les chaînes malformées", () => {
    for (const bad of ["", "abc", "a.b.c", "%%%.###", "e30."]) {
      expect(verifyQuizToken(bad)).toBeNull()
    }
  })

  it("refuse plus de 10 ids (borne du produit)", () => {
    const token = signQuizToken(Array.from({ length: 11 }, (_, i) => `q-${i}`))
    expect(verifyQuizToken(token)).toBeNull()
  })
})
```

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test -- quiz-token`
Expected: FAIL — module `@/features/questions/quiz-token` introuvable.

- [ ] **Step 3: Écrire le module**

```ts
import { createHmac, timingSafeEqual } from "node:crypto"
import "server-only"
import { env } from "@/lib/env/server"

/**
 * Jeton stateless liant le scoring du quiz marketing aux questions réellement
 * servies (#91) : la clé de réponse n'est délivrable que pour un lot signé par
 * NOUS et encore frais. Séparation de domaine dans le message signé : un HMAC
 * produit avec le même secret pour un autre usage n'est pas rejouable ici.
 */

const DOMAIN_PREFIX = "quiz-answer-key:"
const TTL_MS = 60 * 60 * 1000 // 1 h — le quiz légitime dure ~200 s
const MAX_IDS = 10 // aligné sur le clamp du tirage public

type QuizTokenPayload = { v: 1; ids: string[]; exp: number }

const hmac = (payloadB64: string) =>
  createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(DOMAIN_PREFIX + payloadB64)
    .digest()

export const signQuizToken = (questionIds: string[]): string => {
  const payload: QuizTokenPayload = {
    v: 1,
    ids: [...questionIds].sort(),
    exp: Date.now() + TTL_MS,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${payloadB64}.${hmac(payloadB64).toString("base64url")}`
}

/** `null` sur TOUT échec, sans distinction de cause (pas d'oracle). */
export const verifyQuizToken = (token: string): Set<string> | null => {
  const parts = token.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [payloadB64, sigB64] = parts

  const expected = hmac(payloadB64)
  const provided = Buffer.from(sigB64, "base64url")
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (typeof payload !== "object" || payload === null) return null
  const p = payload as Partial<QuizTokenPayload>
  if (p.v !== 1) return null
  if (typeof p.exp !== "number" || p.exp <= Date.now()) return null
  if (
    !Array.isArray(p.ids) ||
    p.ids.length > MAX_IDS ||
    !p.ids.every((id) => typeof id === "string")
  ) {
    return null
  }
  return new Set(p.ids)
}
```

- [ ] **Step 4: Vérifier le vert + gates**

Run: `bun run test -- quiz-token` puis `bun run check`
Expected: PASS (8 tests) ; check PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/questions/quiz-token.test.ts features/questions/quiz-token.ts
git commit -m "feat: jeton HMAC liant le scoring du quiz public aux questions servies"
```

---

### Task 2: Table `quiz_rate_limits` + migration

**Files:**

- Modify: `db/schema/ops.ts` (append)
- Create: `db/migrations/*` (généré)

- [ ] **Step 1: Ajouter la table au schéma**

À la fin de `db/schema/ops.ts` (les imports `integer`, `pgTable`, `text`, `timestamp`, `unique` et `createId` existent déjà) :

```ts
// Rate-limit ANONYME du quiz marketing (#91) : `key` = HMAC de l'IP (jamais
// l'IP en clair), pas de FK user (l'appelant n'a pas de compte). Purgée par le
// cron close-expired (fenêtres > 24 h).
export const quizRateLimits = pgTable(
  "quiz_rate_limits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    key: text("key").notNull(),
    action: text("action").$type<"load" | "score">().notNull(),
    count: integer("count").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  },
  (t) => [unique("quiz_rate_limits_key_action_unique").on(t.key, t.action)],
)
```

(Vérifier que `db/schema/index.ts` ré-exporte `./ops` — c'est déjà le cas pour `uploadRateLimits` ; sinon ajouter l'export.)

- [ ] **Step 2: Générer la migration**

Run: `bun run db:generate`
Expected: un nouveau fichier `db/migrations/XXXX_*.sql` contenant `CREATE TABLE "quiz_rate_limits"` + la contrainte unique. Ne PAS lancer `db:migrate` (les branches d'intégration migrent seules ; la dev/prod migrera au déploiement — `reference_vercel_migrate_on_deploy`).

- [ ] **Step 3: Gates + commit**

Run: `bun run check`
Expected: PASS

```bash
git add db/schema/ops.ts db/migrations
git commit -m "feat: table quiz_rate_limits (rate-limit anonyme du quiz public)"
```

---

### Task 3: Helper `lib/quiz-rate-limit.ts` + purge cron (intégration, RED → GREEN)

**Files:**

- Create: `tests/integration/quiz-rate-limit.test.ts`
- Create: `lib/quiz-rate-limit.ts`
- Modify: `app/api/cron/close-expired/route.ts`
- Modify: `vitest.config.ts` (coverage.exclude — revue #1)
- Modify: `app/api/e2e/route.ts` (purge e2e — revue #5)
- Modify: `.claude/rules/e2e-testing.md` (doc de la purge)

- [ ] **Step 1: Écrire le test d'intégration (rouge)**

```ts
import { eq } from "drizzle-orm"
import { afterAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { quizRateLimits } from "@/db/schema"
import { createId } from "@/lib/ids"
import {
  cleanupQuizRateLimits,
  consumeQuizRateLimit,
} from "@/lib/quiz-rate-limit"

// getClientIpKey (next/headers) n'est pas exercé ici — on teste le compteur
// avec des clés synthétiques ; le mock évite juste l'import RSC.
vi.mock("next/headers", () => ({ headers: vi.fn() }))

const keyA = `test-key-${createId()}`
const keyB = `test-key-${createId()}`

afterAll(async () => {
  for (const key of [keyA, keyB]) {
    await db.delete(quizRateLimits).where(eq(quizRateLimits.key, key))
  }
})

describe("consumeQuizRateLimit", () => {
  it("autorise 30 appels/h puis refuse le 31e ; une autre clé n'est pas affectée", async () => {
    for (let i = 0; i < 30; i++) {
      expect(await consumeQuizRateLimit(keyA, "load")).toBe(true)
    }
    expect(await consumeQuizRateLimit(keyA, "load")).toBe(false)
    expect(await consumeQuizRateLimit(keyB, "load")).toBe(true)
  })

  it("compte load et score indépendamment", async () => {
    // keyA est épuisée en "load" (test précédent) mais vierge en "score".
    expect(await consumeQuizRateLimit(keyA, "score")).toBe(true)
  })

  it("réinitialise le compteur quand la fenêtre expire", async () => {
    await db
      .update(quizRateLimits)
      .set({ windowStart: new Date(Date.now() - 61 * 60 * 1000) })
      .where(eq(quizRateLimits.key, keyA))
    expect(await consumeQuizRateLimit(keyA, "load")).toBe(true)
  })
})

describe("cleanupQuizRateLimits", () => {
  it("purge les fenêtres de plus de 24 h, conserve les récentes", async () => {
    await db
      .update(quizRateLimits)
      .set({ windowStart: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(quizRateLimits.key, keyB))
    await cleanupQuizRateLimits()

    const gone = await db
      .select({ id: quizRateLimits.id })
      .from(quizRateLimits)
      .where(eq(quizRateLimits.key, keyB))
    expect(gone).toHaveLength(0)

    const kept = await db
      .select({ id: quizRateLimits.id })
      .from(quizRateLimits)
      .where(eq(quizRateLimits.key, keyA))
    expect(kept.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test:integration`
Expected: FAIL — `quiz-rate-limit.test.ts` échoue à l'import (`@/lib/quiz-rate-limit` n'existe pas). Le reste de la suite reste vert.

- [ ] **Step 3: Écrire le helper**

Pattern copié de `lib/upload-rate-limit.ts` (fenêtre glissante + `FOR UPDATE`, consommation atomique AVANT le travail — TOCTOU fermé, appels abusifs comptés même si le travail échoue ensuite).

```ts
import { and, eq, lt } from "drizzle-orm"
import { headers } from "next/headers"
import { createHmac } from "node:crypto"
import "server-only"
import { db } from "@/db"
import { quizRateLimits } from "@/db/schema"
import { env } from "@/lib/env/server"

const WINDOW_MS = 60 * 60 * 1000 // 1 h
const MAX_PER_WINDOW = 30 // légitime = 1 appel/action/tentative ; marge NAT
const RETENTION_MS = 24 * 60 * 60 * 1000

export type QuizRateLimitAction = "load" | "score"

/**
 * Clé pseudonyme de l'appelant anonyme : HMAC de l'IP (`x-forwarded-for` posé
 * par Vercel, premier élément = client). Le HMAC (et non un simple hash) déjoue
 * le brute-force de l'espace IPv4 — aucune IP en clair en base. Sans header
 * (hors proxy) : bucket partagé "unknown", fail-closed assumé.
 */
export const getClientIpKey = async (): Promise<string> => {
  const h = await headers()
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`quiz-ip:${ip}`)
    .digest("hex")
    .slice(0, 32)
}

/** Consomme un slot pour `(key, action)`. `false` = limite atteinte (refus silencieux côté action). */
export const consumeQuizRateLimit = async (
  key: string,
  action: QuizRateLimitAction,
): Promise<boolean> => {
  const now = Date.now()

  return db.transaction(async (tx) => {
    // Garantit la ligne sans toucher aux compteurs existants (course à la
    // première insertion), puis verrou de ligne : les requêtes concurrentes de
    // la même clé sont sérialisées.
    await tx
      .insert(quizRateLimits)
      .values({ key, action, count: 0, windowStart: new Date(now) })
      .onConflictDoNothing({
        target: [quizRateLimits.key, quizRateLimits.action],
      })

    const [row] = await tx
      .select({
        id: quizRateLimits.id,
        count: quizRateLimits.count,
        windowStart: quizRateLimits.windowStart,
      })
      .from(quizRateLimits)
      .where(
        and(eq(quizRateLimits.key, key), eq(quizRateLimits.action, action)),
      )
      .for("update")
      .limit(1)
    if (!row) return true // garde défensive : la ligne existe forcément

    const windowAge = now - row.windowStart.getTime()
    if (windowAge >= WINDOW_MS) {
      await tx
        .update(quizRateLimits)
        .set({ count: 1, windowStart: new Date(now) })
        .where(eq(quizRateLimits.id, row.id))
      return true
    }
    if (row.count < MAX_PER_WINDOW) {
      await tx
        .update(quizRateLimits)
        .set({ count: row.count + 1 })
        .where(eq(quizRateLimits.id, row.id))
      return true
    }
    return false
  })
}

/** Purge des fenêtres mortes (> 24 h) — la table ne croît pas sans borne. */
export const cleanupQuizRateLimits = async (): Promise<{
  deletedCount: number
}> => {
  const res = await db
    .delete(quizRateLimits)
    .where(lt(quizRateLimits.windowStart, new Date(Date.now() - RETENTION_MS)))
    .returning({ id: quizRateLimits.id })
  return { deletedCount: res.length }
}
```

- [ ] **Step 4: Câbler la purge dans le cron**

Dans `app/api/cron/close-expired/route.ts` :

Import (avec les autres imports) :

```ts
import { cleanupQuizRateLimits } from "@/lib/quiz-rate-limit"
```

Étendre le `Promise.all` :

```ts
const [
  examParticipations,
  trainingSessions,
  anonymizedAccounts,
  quizRateLimitCleanup,
] = await Promise.all([
  closeExpiredExamParticipations(),
  closeExpiredTrainingSessions(),
  anonymizeExpiredDeletedAccounts(),
  cleanupQuizRateLimits(),
])
```

Et l'ajouter à la réponse JSON :

```ts
return Response.json({
  examParticipations,
  trainingSessions,
  anonymizedAccounts,
  notifications,
  quizRateLimitCleanup,
})
```

(Pas besoin de l'ajouter à la condition de log — purge silencieuse.)

- [ ] **Step 5: Exclure le helper de la coverage CI (revue #1)**

`lib/quiz-rate-limit.ts` matche `coverage.include: "lib/**/*.ts"` mais n'est
couvert QUE par les tests d'intégration (hors coverage CI) → sans exclusion,
~50 statements à 0 % font tomber le seuil 80 % (marge mesurée : Functions
81,13 %). Dans `vitest.config.ts`, bloc `coverage.exclude` (l.52-57), après
`"lib/upload-rate-limit.ts"` :

```ts
        "lib/upload-rate-limit.ts",
        "lib/quiz-rate-limit.ts",
```

(même justification que le commentaire existant « Infra server-only (I/O) :
couverte par les tests d'integration ».)

- [ ] **Step 6: Purger `quiz_rate_limits` au reset e2e (revue #5)**

En local, pas de `x-forwarded-for` → la suite Playwright
`e2e/tests/evaluation-quiz.spec.ts` (5 loads + 1 score par run) partage UN
bucket 30/h et flakerait dès ~6 runs/h. `reset-exam` est appelée par
`global.setup.ts` en setup ET teardown → y purger la table (compteurs
éphémères, base de dev — la route répond 404 en prod).

Dans `app/api/e2e/route.ts` : ajouter `quizRateLimits` à l'import
`@/db/schema` (l.3-17), puis dans `resetExam`, juste avant le `return` final :

```ts
// Purge les compteurs du rate-limit quiz public (#91) : en local toutes les
// requêtes partagent un bucket IP → sans purge, les runs e2e successifs de
// evaluation-quiz.spec.ts saturent la limite (30/h) et la suite flake.
const quizRateLimitRows = await db
  .delete(quizRateLimits)
  .returning({ id: quizRateLimits.id })

return {
  userFound: true as const,
  deletedParticipations,
  deletedTrainingSessions: trainingRows.length,
  deletedQuizRateLimits: quizRateLimitRows.length,
  activeExamId,
}
```

Dans `.claude/rules/e2e-testing.md`, § « Route support `/api/e2e` », compléter
la puce `reset-exam` : « … + purge `quiz_rate_limits` (rate-limit IP du quiz
public #91 : bucket local partagé, sinon la suite `evaluation-quiz` flake au
fil des runs). »

- [ ] **Step 7: Vérifier le vert + gates**

Run: `bun run test:integration` puis `bun run check`
Expected: PASS (4 tests du nouveau fichier verts, reste inchangé) ; check PASS.

- [ ] **Step 8: Commit**

```bash
git add tests/integration/quiz-rate-limit.test.ts lib/quiz-rate-limit.ts app/api/cron/close-expired/route.ts vitest.config.ts app/api/e2e/route.ts .claude/rules/e2e-testing.md
git commit -m "feat: rate-limit IP des actions publiques du quiz + purges cron et e2e"
```

---

### Task 4: Verrou anonyme `getOpenExamQuestionIds` (intégration, RED → GREEN)

**Files:**

- Modify: `tests/integration/questions-quiz-dal.test.ts` (fixtures examens + nouveau describe)
- Modify: `features/exams/dal.ts` (nouveau helper, sous `getOpenExamLockedQuestionIds` ~l.738)

- [ ] **Step 1: Ajouter les fixtures examens au test quiz (et le describe rouge)**

Dans `tests/integration/questions-quiz-dal.test.ts` :

Imports à étendre :

```ts
import {
  examQuestions,
  exams,
  questionExplanations,
  questionImages,
  questions,
  user,
} from "@/db/schema"
import { getOpenExamQuestionIds } from "@/features/exams/dal"
```

Fixtures (après les déclarations existantes `qImg`/`q2`/`ids`) :

```ts
// qOpen appartient à un examen OUVERT (endDate future) → verrouillée pour le
// canal public ; qClosed appartient à un examen CLOS uniquement → témoin
// (l'examen clos ne verrouille pas, pattern q10 de exams.test.ts).
const qOpen = ids[2]
const qClosed = ids[3]
const examCreatorId = createId()
const examOpenId = createId()
const examClosedId = createId()
```

Dans le `beforeAll` existant, après les inserts de questions :

```ts
await db.insert(user).values({
  id: examCreatorId,
  name: "Créateur Examen Quiz",
  email: `quiz91-${suffix}@test.invalid`,
  emailVerified: true,
})
await db.insert(exams).values([
  {
    id: examOpenId,
    title: `Examen ouvert ${suffix}`,
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    completionTime: 3600,
    createdBy: examCreatorId,
  },
  {
    id: examClosedId,
    title: `Examen clos ${suffix}`,
    startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
    endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    completionTime: 3600,
    createdBy: examCreatorId,
  },
])
await db.insert(examQuestions).values([
  { examId: examOpenId, questionId: qOpen, position: 0 },
  { examId: examClosedId, questionId: qClosed, position: 0 },
])
```

Dans le `afterAll` existant, AVANT les deletes de questions (FK `restrict`
`exam_questions.question_id` ; le delete des `exams` cascade ses
`exam_questions`) et APRÈS pour le user (FK `restrict` `exams.created_by`) :

```ts
afterAll(async () => {
  await db.delete(exams).where(inArray(exams.id, [examOpenId, examClosedId]))
  await db.delete(questionImages).where(inArray(questionImages.questionId, ids))
  await db
    .delete(questionExplanations)
    .where(inArray(questionExplanations.questionId, ids))
  await db.delete(questions).where(inArray(questions.id, ids))
  await db.delete(user).where(eq(user.id, examCreatorId))
})
```

(ajouter `eq` à l'import drizzle du fichier : `import { eq, inArray } from "drizzle-orm"`)

Nouveau describe :

```ts
describe("getOpenExamQuestionIds (verrou anonyme)", () => {
  it("verrouille les questions d'un examen ouvert, pas celles d'un examen clos", async () => {
    const locked = await getOpenExamQuestionIds([
      qOpen,
      qClosed,
      q2,
      createId(),
    ])
    expect(locked).toEqual(new Set([qOpen]))
  })

  it("Set vide pour une liste vide", async () => {
    expect((await getOpenExamQuestionIds([])).size).toBe(0)
  })
})
```

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test:integration`
Expected: FAIL — `questions-quiz-dal.test.ts` échoue à l'import (`getOpenExamQuestionIds` n'est pas exporté par `@/features/exams/dal`).

- [ ] **Step 3: Écrire le helper**

Dans `features/exams/dal.ts`, juste après `getOpenExamLockedQuestionIds`
(≈ l.738 — les imports `and`, `gt`, `inArray`, `eq`, `exams`, `examQuestions`
existent déjà dans ce fichier) :

```ts
/**
 * Variante ANONYME de `getOpenExamLockedQuestionIds` : parmi `questionIds`,
 * celles figurant dans AU MOINS un examen ouvert (`endDate` future), sans
 * dimension utilisateur. Canal public du quiz marketing (#91) : l'appelant
 * étant anonyme, la clé d'une question d'examen ouvert ne doit fuiter pour
 * PERSONNE — une question aussi présente dans un examen clos reste verrouillée
 * (l'examen ouvert prime).
 */
export const getOpenExamQuestionIds = async (
  questionIds: string[],
): Promise<Set<string>> => {
  if (questionIds.length === 0) return new Set()
  const rows = await db
    .selectDistinct({ questionId: examQuestions.questionId })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .where(
      and(
        gt(exams.endDate, new Date()),
        inArray(examQuestions.questionId, questionIds),
      ),
    )
  return new Set(rows.map((r) => r.questionId))
}
```

- [ ] **Step 4: Vérifier le vert + gates**

Run: `bun run test:integration` puis `bun run check`
Expected: PASS partout (les tests existants du fichier restent verts : le tirage n'exclut encore rien).

- [ ] **Step 5: Commit**

```bash
git add tests/integration/questions-quiz-dal.test.ts features/exams/dal.ts
git commit -m "feat: verrou anonyme des questions d'examens ouverts (canal public)"
```

---

### Task 5: Tirage — exclusion SQL des examens ouverts + clamp 10 (RED → GREEN)

**Files:**

- Modify: `tests/integration/questions-quiz-dal.test.ts` (describe `getRandomQuizQuestions`)
- Modify: `features/questions/dal.ts:405-431` (`getRandomQuizQuestions`)

- [ ] **Step 1: Mettre à jour les attentes du tirage (rouge)**

Dans le describe `getRandomQuizQuestions` existant, remplacer le test
« borne le nombre et filtre par domaine » par :

```ts
it("borne le nombre, filtre par domaine et exclut les examens ouverts", async () => {
  const three = await getRandomQuizQuestions({ domain: DOMAIN, count: 3 })
  expect(three).toHaveLength(3)
  expect(three.every((q) => q.domain === DOMAIN)).toBe(true)

  // qOpen (examen ouvert) n'est jamais servie ; qClosed (examen clos) l'est.
  const servable = ids.filter((id) => id !== qOpen)
  const all = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
  expect(new Set(all.map((q) => q._id))).toEqual(new Set(servable))
})
```

Ajouter deux tests :

```ts
it("ne sert jamais une question d'un examen ouvert (tirages répétés)", async () => {
  for (let i = 0; i < 5; i++) {
    const items = await getRandomQuizQuestions({ domain: DOMAIN, count: 10 })
    expect(items.map((q) => q._id)).not.toContain(qOpen)
  }
})

it("clampe count à 10", async () => {
  const items = await getRandomQuizQuestions({ count: 50 })
  expect(items.length).toBeLessThanOrEqual(10)
})
```

Et dans les deux tests existants qui appellent `getRandomQuizQuestions({ domain: DOMAIN, count: 50 })` (« ne fuite jamais… » et « joint les images… »), remplacer `count: 50` par `count: 10` (le clamp rend `50` équivalent, mais les tests doivent lire la nouvelle borne).

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test:integration`
Expected: FAIL — « borne le nombre… » attend 4 questions sans `qOpen` mais en reçoit 5 (l'exclusion n'existe pas encore) ; « ne sert jamais… » échoue dès qu'un tirage inclut `qOpen`.

- [ ] **Step 3: Implémenter l'exclusion + le clamp**

Dans `features/questions/dal.ts`, `getRandomQuizQuestions` :

Imports à étendre (l.1-23) : ajouter `gt` à l'import drizzle et `exams` à
l'import `@/db/schema` (`notExists`, `examQuestions` y sont déjà).

Remplacer :

```ts
const safeCount = clamp(count, 1, 50)
const where = and(
  isNull(questions.deletedAt),
  domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
)
```

par :

```ts
const safeCount = clamp(count, 1, 10)
const where = and(
  isNull(questions.deletedAt),
  // Anti-triche #91 : jamais de question d'un examen OUVERT dans le quiz
  // public. L'exclusion vit dans le WHERE (pas en post-filtrage) pour que
  // `ORDER BY random() LIMIT n` rende quand même n questions corrigeables.
  notExists(
    db
      .select({ x: sql`1` })
      .from(examQuestions)
      .innerJoin(exams, eq(exams.id, examQuestions.examId))
      .where(
        and(
          eq(examQuestions.questionId, questions.id),
          gt(exams.endDate, sql`now()`),
        ),
      ),
  ),
  domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
)
```

Mettre à jour la doc du helper (l.398-404) : mentionner l'exclusion des
examens ouverts et le clamp `1..10`.

- [ ] **Step 4: Vérifier le vert + gates**

Run: `bun run test:integration` puis `bun run check`
Expected: PASS partout.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/questions-quiz-dal.test.ts features/questions/dal.ts
git commit -m "fix: le tirage du quiz public exclut les examens ouverts et clampe a 10"
```

---

### Task 6: Actions publiques — jeton + re-check + rate-limit (RED → GREEN)

**Files:**

- Modify: `features/questions/schemas.ts` (append)
- Modify: `tests/integration/questions-quiz-dal.test.ts` (describes actions)
- Modify: `features/questions/actions.ts:82-137` (les deux actions publiques)

- [ ] **Step 1: Ajouter le schéma zod**

À la fin de `features/questions/schemas.ts` :

```ts
// Entrées PUBLIQUES (quiz marketing, appelant anonyme) : bornes strictes,
// refus silencieux côté action (pas de message d'erreur → pas d'oracle).
// Sans zod sur le tirage, `count: "abc"` → clamp = NaN → `LIMIT NaN` → 500.
export const loadRandomQuizQuestionsSchema = z.object({
  count: z.number().int(),
  domain: z.string().max(100).optional(),
})

export const scoreQuizAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(64),
        selectedAnswer: z.string().max(500).nullable(),
      }),
    )
    .max(10),
  token: z.string().min(1).max(2048),
})
```

- [ ] **Step 2: Étendre le test d'intégration (rouge)**

Dans `tests/integration/questions-quiz-dal.test.ts` :

Imports à étendre :

```ts
import { headers } from "next/headers"
import { quizRateLimits } from "@/db/schema"
import {
  loadRandomQuizQuestions,
  scoreQuizAnswers,
} from "@/features/questions/actions"
import { signQuizToken, verifyQuizToken } from "@/features/questions/quiz-token"
import { getClientIpKey } from "@/lib/quiz-rate-limit"
```

Mock supplémentaire (avec les `vi.mock` existants) + helper IP :

```ts
vi.mock("next/headers", () => ({ headers: vi.fn() }))

// Chaque test prend une "IP" unique (chaîne arbitraire : elle est HMAC-ée) →
// compteurs indépendants entre tests. Les IPs utilisées sont tracées pour le
// cleanup (les clés stockées sont des HMAC, non corrélables sans re-calcul).
// `setIpHeader` (mock seul, ne mute PAS usedIps) est ce que le cleanup
// utilise — itérer usedIps avec une fonction qui y push serait une boucle
// infinie (revue design 2026-07-09, constat #3).
const usedIps: string[] = []
const setIpHeader = (ip: string) =>
  vi
    .mocked(headers)
    .mockResolvedValue(new Headers({ "x-forwarded-for": ip }) as never)
const withIp = (ip: string) => {
  usedIps.push(ip)
  setIpHeader(ip)
}
```

Dans le `afterAll`, ajouter en tête :

```ts
for (const ip of usedIps) {
  setIpHeader(ip)
  await db
    .delete(quizRateLimits)
    .where(eq(quizRateLimits.key, await getClientIpKey()))
}
```

Remplacer le describe `scoreQuizAnswers (action publique)` existant par :

```ts
describe("scoreQuizAnswers (action publique)", () => {
  const EMPTY = { score: 0, totalQuestions: 0, questionResults: [] }

  it("score avec un jeton valide ; les ids hors jeton sont omis (anti-moisson)", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([qImg, q2])
    const result = await scoreQuizAnswers({
      token,
      answers: [
        { questionId: qImg, selectedAnswer: "A" }, // correct
        { questionId: q2, selectedAnswer: "mauvaise" }, // incorrect
        { questionId: ids[4], selectedAnswer: "C" }, // HORS jeton → omis
      ],
    })

    expect(result.score).toBe(1)
    expect(result.totalQuestions).toBe(2)
    expect(result.questionResults.map((r) => r.questionId)).not.toContain(
      ids[4],
    )
    const imgResult = result.questionResults.find((r) => r.questionId === qImg)
    expect(imgResult).toMatchObject({
      isCorrect: true,
      correctAnswer: "A",
      explanation: "Exp img",
      references: ["R1", "R2"],
    })
  })

  it("refuse de servir la clé d'ids arbitraires sans jeton les couvrant", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([q2])
    const result = await scoreQuizAnswers({
      token,
      answers: [{ questionId: qImg, selectedAnswer: "A" }],
    })
    expect(result).toEqual(EMPTY)
  })

  it("refuse un jeton falsifié ou malformé", async () => {
    withIp(`ip-${createId()}`)
    const valid = signQuizToken([qImg])
    const tampered = valid.endsWith("A")
      ? `${valid.slice(0, -1)}B`
      : `${valid.slice(0, -1)}A`
    for (const bad of [tampered, "abc"]) {
      const result = await scoreQuizAnswers({
        token: bad,
        answers: [{ questionId: qImg, selectedAnswer: "A" }],
      })
      expect(result).toEqual(EMPTY)
    }
  })

  it("refuse un jeton expiré", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() - 2 * 60 * 60 * 1000)
    const stale = signQuizToken([qImg])
    vi.useRealTimers()

    withIp(`ip-${createId()}`)
    const result = await scoreQuizAnswers({
      token: stale,
      answers: [{ questionId: qImg, selectedAnswer: "A" }],
    })
    expect(result).toEqual(EMPTY)
  })

  it("n'expose jamais la clé d'une question d'examen ouvert, même sous jeton valide (examen ouvert après émission)", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([qOpen, q2])
    const result = await scoreQuizAnswers({
      token,
      answers: [
        { questionId: qOpen, selectedAnswer: "C" },
        { questionId: q2, selectedAnswer: "B" },
      ],
    })
    expect(result.questionResults.map((r) => r.questionId)).toEqual([q2])
    expect(result.totalQuestions).toBe(1)
  })

  it("refuse une entrée hors bornes zod (> 10 réponses)", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([qImg])
    const result = await scoreQuizAnswers({
      token,
      answers: Array.from({ length: 11 }, () => ({
        questionId: qImg,
        selectedAnswer: "A",
      })),
    })
    expect(result).toEqual(EMPTY)
  })

  it("refuse au-delà de 30 scorings/h pour la même IP", async () => {
    withIp(`ip-${createId()}`)
    const token = signQuizToken([q2])
    for (let i = 0; i < 30; i++) {
      const r = await scoreQuizAnswers({
        token,
        answers: [{ questionId: q2, selectedAnswer: "B" }],
      })
      expect(r.totalQuestions).toBe(1)
    }
    const refused = await scoreQuizAnswers({
      token,
      answers: [{ questionId: q2, selectedAnswer: "B" }],
    })
    expect(refused).toEqual(EMPTY)
  })
})

describe("loadRandomQuizQuestions (action publique)", () => {
  it("renvoie les questions et un jeton couvrant exactement les ids servis", async () => {
    withIp(`ip-${createId()}`)
    const bundle = await loadRandomQuizQuestions({
      count: 3,
      domain: DOMAIN,
    })
    expect(bundle.questions).toHaveLength(3)
    expect(bundle.token).not.toBeNull()
    expect(verifyQuizToken(bundle.token!)).toEqual(
      new Set(bundle.questions.map((q) => q._id)),
    )
  })

  it("refuse au-delà de 30 tirages/h pour la même IP", async () => {
    withIp(`ip-${createId()}`)
    for (let i = 0; i < 30; i++) {
      const bundle = await loadRandomQuizQuestions({
        count: 1,
        domain: DOMAIN,
      })
      expect(bundle.token).not.toBeNull()
    }
    const refused = await loadRandomQuizQuestions({
      count: 1,
      domain: DOMAIN,
    })
    expect(refused).toEqual({ questions: [], token: null })
  })

  it("refuse un count non numérique (zod) sans throw", async () => {
    withIp(`ip-${createId()}`)
    const bundle = await loadRandomQuizQuestions({ count: "abc" as never })
    expect(bundle).toEqual({ questions: [], token: null })
  })
})
```

- [ ] **Step 3: Vérifier le rouge**

Run: `bun run test:integration`
Expected: FAIL — l'ancienne `scoreQuizAnswers` ignore `token` et sert `qImg`
sans couverture (« refuse de servir la clé d'ids arbitraires… » échoue :
c'est la moisson #91 démontrée) ; `loadRandomQuizQuestions` renvoie un tableau,
pas un bundle.

- [ ] **Step 4: Réécrire les deux actions**

Dans `features/questions/actions.ts` :

Imports à ajouter :

```ts
import { getOpenExamQuestionIds } from "@/features/exams/dal"
import { consumeQuizRateLimit, getClientIpKey } from "@/lib/quiz-rate-limit"
import { signQuizToken, verifyQuizToken } from "./quiz-token"
```

et étendre l'import de `./schemas` avec `loadRandomQuizQuestionsSchema` et
`scoreQuizAnswersSchema`.

Remplacer le bloc `[Public] Quiz marketing` (l.82-137) par :

```ts
/**
 * [Public] Questions aléatoires pour le quiz d'évaluation marketing. Sans
 * session (page publique) mais : rate-limit IP + jeton HMAC couvrant les ids
 * servis — `scoreQuizAnswers` ne corrige que ce que CE bundle a servi (#91).
 * La DAL masque `correctAnswer`/`explanation` et exclut les examens ouverts.
 */
export type QuizBundle = {
  questions: QuizQuestionView[]
  token: string | null
}

export const loadRandomQuizQuestions = async (args: {
  count: number
  domain?: string
}): Promise<QuizBundle> => {
  // zod AVANT le rate-limit : une entrée malformée ne consomme pas de slot
  // (et ne throw plus — l'ancien clamp propageait NaN jusqu'à LIMIT).
  const parsed = loadRandomQuizQuestionsSchema.safeParse(args)
  if (!parsed.success) return { questions: [], token: null }

  const ipKey = await getClientIpKey()
  if (!(await consumeQuizRateLimit(ipKey, "load"))) {
    return { questions: [], token: null }
  }
  const quizQuestions = await getRandomQuizQuestions(parsed.data)
  if (quizQuestions.length === 0) return { questions: [], token: null }
  return {
    questions: quizQuestions,
    token: signQuizToken(quizQuestions.map((q) => q._id)),
  }
}

export type QuizQuestionResult = {
  questionId: string
  isCorrect: boolean
  correctAnswer: string
  explanation: string
  references: string[]
  explanationImages: { url: string; storagePath: string; order: number }[]
}

export type QuizScore = {
  score: number
  totalQuestions: number
  questionResults: QuizQuestionResult[]
}

const EMPTY_SCORE: QuizScore = {
  score: 0,
  totalQuestions: 0,
  questionResults: [],
}

/**
 * [Public] Score le quiz marketing côté serveur. Refus TOUJOURS silencieux
 * (`QuizScore` vide, même shape) : pas d'oracle sur la raison — zod hors
 * bornes, rate-limit, jeton invalide/expiré. Séquence : zod → rate-limit IP
 * (consommé AVANT le travail) → jeton (intersection ids servis) → re-check
 * examens ouverts (un examen a pu OUVRIR pendant la vie du jeton — la clé
 * reste verrouillée sur TOUS les canaux pendant la fenêtre, cf. #86/#93).
 */
export const scoreQuizAnswers = async (args: {
  answers: { questionId: string; selectedAnswer: string | null }[]
  token: string
}): Promise<QuizScore> => {
  const parsed = scoreQuizAnswersSchema.safeParse(args)
  if (!parsed.success) return EMPTY_SCORE

  const ipKey = await getClientIpKey()
  if (!(await consumeQuizRateLimit(ipKey, "score"))) return EMPTY_SCORE

  const servedIds = verifyQuizToken(parsed.data.token)
  if (!servedIds) return EMPTY_SCORE

  const seen = new Set<string>()
  const answers = parsed.data.answers.filter((a) => {
    if (!servedIds.has(a.questionId) || seen.has(a.questionId)) return false
    seen.add(a.questionId)
    return true
  })
  if (answers.length === 0) return EMPTY_SCORE

  const answeredIds = answers.map((a) => a.questionId)
  const lockedIds = await getOpenExamQuestionIds(answeredIds)
  const keyMap = await getQuizAnswerKey(
    answeredIds.filter((id) => !lockedIds.has(id)),
  )

  let score = 0
  const questionResults: QuizQuestionResult[] = []
  for (const a of answers) {
    const key = keyMap.get(a.questionId)
    if (!key) continue
    const isCorrect = a.selectedAnswer === key.correctAnswer
    if (isCorrect) score++
    questionResults.push({
      questionId: a.questionId,
      isCorrect,
      correctAnswer: key.correctAnswer,
      explanation: key.explanation,
      references: key.references,
      explanationImages: key.explanationImages,
    })
  }

  return { score, totalQuestions: questionResults.length, questionResults }
}
```

(`EMPTY_SCORE` est un const module partagé jamais muté — sérialisé à chaque
réponse par le runtime Server Actions.)

- [ ] **Step 5: Vérifier le vert**

Run: `bun run test:integration`
Expected: PASS — les 9 nouveaux tests verts, le reste de la suite inchangé.

`bun run check` échouera encore sur `app/(marketing)/evaluation/quiz/page.tsx`
(l'appelant n'est pas encore adapté au bundle) — c'est la Task 7 ; ne PAS
committer `check` rouge : Task 6 et 7 peuvent être committées ensemble si
`check` bloque un pre-commit hook, sinon committer ici et enchaîner.

- [ ] **Step 6: Commit**

```bash
git add features/questions/schemas.ts features/questions/actions.ts tests/integration/questions-quiz-dal.test.ts
git commit -m "fix: scoreQuizAnswers verrouille sur jeton signe + examens ouverts + rate-limit (#91)"
```

---

### Task 7: Client — jeton + écrans d'erreur (fin du loader infini)

**Files:**

- Modify: `app/(marketing)/evaluation/quiz/page.tsx`

- [ ] **Step 1: Adapter l'état et le chargement**

Remplacer (l.13-17) l'import des actions pour récupérer aussi le type :

```ts
import {
  type QuizBundle,
  loadRandomQuizQuestions,
  scoreQuizAnswers,
} from "@/features/questions/actions"
```

Supprimer le type local devenu mort et son import (sinon ESLint `unused` casse
`check`) — l.17-21 :

```ts
import type { QuizQuestionView } from "@/features/questions/dal"

// Forme renvoyée par le DAL public (sans correctAnswer/explanation), assignable
// au contrat `QuestionDoc` des composants quiz partagés via cast.
type QuizQuestion = QuizQuestionView
```

Remplacer l'état `quizQuestions` (l.36-38) par :

```ts
const [quizBundle, setQuizBundle] = useState<QuizBundle | null>(null)
const [scoreFailed, setScoreFailed] = useState(false)
const quizQuestions = quizBundle ? quizBundle.questions : null
```

Adapter l'effet de chargement (l.53-68) :

```ts
useEffect(() => {
  if (questionsLoadedRef.current) return
  questionsLoadedRef.current = true

  loadRandomQuizQuestions({ count: 10 }).then((bundle) => {
    setQuizBundle(bundle)
    if (bundle.questions.length > 0 && bundle.questions.length < 10) {
      setQuizState((prev) => ({
        ...prev,
        userAnswers: new Array(bundle.questions.length).fill(null),
        timeRemaining: bundle.questions.length * 20,
        totalTime: bundle.questions.length * 20,
      }))
    }
  })
}, [])
```

- [ ] **Step 2: Adapter le scoring**

Remplacer l'effet de scoring (l.87-117) :

```ts
useEffect(() => {
  if (!quizState.isCompleted || !quizBundle || scoringTriggeredRef.current)
    return
  if (quizBundle.questions.length === 0) return
  scoringTriggeredRef.current = true

  // Pas de setState SYNCHRONE dans le corps de l'effet (ESLint
  // react-hooks/set-state-in-effect casse `check` — revue #2) : le cas
  // token null est dérivé au RENDU (écran « Session expirée »), jamais
  // stocké ici. setScoreFailed ne vit que dans le .then (asynchrone, OK).
  const token = quizBundle.token
  if (!token) return

  const served = quizBundle.questions
  const answers = served.map((q, i) => ({
    questionId: q._id,
    selectedAnswer: quizState.userAnswers[i],
  }))

  scoreQuizAnswers({ answers, token }).then((result) => {
    // Refus silencieux serveur (jeton expiré, rate-limit, verrou examen
    // total) → écran « session expirée », pas de résultats à trous.
    if (result.totalQuestions === 0) {
      setScoreFailed(true)
      return
    }
    const resultMap = new Map(
      result.questionResults.map((r) => [r.questionId, r]),
    )
    const merged = served.map((q) => {
      const scored = resultMap.get(q._id)
      return {
        ...q,
        correctAnswer: scored?.correctAnswer ?? "",
        explanation: scored?.explanation ?? "",
        references: scored?.references ?? [],
        // Images d'explication révélées avec la clé de correction — rendues
        // par `QuestionCard variant="review"` uniquement (jamais en passation).
        explanationImages: scored?.explanationImages ?? [],
      } satisfies QuestionDoc
    })
    setScoredResults({ score: result.score, mergedQuestions: merged })
  })
}, [quizState.isCompleted, quizBundle, quizState.userAnswers])
```

- [ ] **Step 3: Écrans d'erreur (remplacer les gardes de rendu)**

Remplacer la garde `if (!quizQuestions || quizQuestions.length === 0)`
(l.159-170) par :

```tsx
if (!quizBundle) {
  return (
    <div className="flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
        <p className="text-gray-600 dark:text-gray-300">
          Chargement des questions...
        </p>
      </div>
    </div>
  )
}

// Refus serveur (rate-limit, banque vide) : message générique volontairement
// identique quelle que soit la cause — pas d'oracle côté client.
if (!quizQuestions || quizQuestions.length === 0) {
  return (
    <div className="flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      <div className="text-center">
        <p className="mb-4 text-gray-600 dark:text-gray-300">
          Le quiz est momentanément indisponible. Réessayez plus tard.
        </p>
        <Button onClick={restartQuiz}>Réessayer</Button>
      </div>
    </div>
  )
}
```

Dans le bloc `if (quizState.isCompleted)` (l.173-196), AVANT la garde
`if (!scoredResults)`, ajouter (le `!quizBundle.token` dérive le cas « jeton
absent » au rendu — l'effet ci-dessus n'a pas le droit de le stocker) :

```tsx
if (scoreFailed || !quizBundle.token) {
  return (
    <div className="flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      <div className="text-center">
        <p className="mb-4 text-gray-600 dark:text-gray-300">
          Session expirée — recommencez le quiz.
        </p>
        <Button onClick={restartQuiz}>Recommencer</Button>
      </div>
    </div>
  )
}
```

(`restartQuiz` existe déjà : `window.location.reload()` — il sert aussi de
« Réessayer ». `handleNextQuestion`/`handleAnswerSelect` continuent d'utiliser
`quizQuestions`, désormais dérivé du bundle — aucun autre changement.)

- [ ] **Step 4: Gates complets**

Run: `bun run check && bun run test`
Expected: PASS partout (le type `QuizQuestion`/imports du fichier compilent, la suite frontend est inchangée — aucun test existant ne mocke ces deux actions, vérifié).

- [ ] **Step 5: Vérification manuelle (par l'utilisateur)**

Demander à l'utilisateur de lancer `bun dev` et vérifier `/evaluation/quiz` :
quiz complet (10 questions), soumission → résultats avec corrections ; recharger
~31 fois pour observer l'écran « momentanément indisponible » (optionnel).
NE PAS lancer le serveur soi-même.

- [ ] **Step 6: Commit**

```bash
git add "app/(marketing)/evaluation/quiz/page.tsx"
git commit -m "fix: page quiz marketing - jeton de scoring + ecrans d'erreur"
```

---

### Task 8: Gates finaux

(Les docs sont formatées et commitées depuis la Task 0 ; si spec/plan ont été
retouchés en cours d'exécution, re-passer `bunx prettier --write` dessus et
committer avant les gates.)

- [ ] **Step 1: Gates finaux (avant revue/PR)**

Run: `bun run check && bun run test && bun run test:coverage && bun run test:integration`
Expected: PASS partout. `test:coverage` est OBLIGATOIRE ici (revue #1) : c'est
lui qui vérifie que l'exclusion de `lib/quiz-rate-limit.ts` suffit à tenir le
seuil CI de 80 % — `bun run test` seul ne le verrait pas.

---

## Hors scope (rappel spec)

CAPTCHA/BotID, pool démo dédié, généralisation de `upload_rate_limits`,
protection contre le scraping distribué « au rythme du produit » (résiduel
assumé). Ne rien implémenter de tout ça.
