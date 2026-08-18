# Résilience du pool pg aux réveils Neon — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retenter l'acquisition de connexion sur les erreurs de réveil Neon (53300/57P03) et borner tout connect à 10 s, pour que `NOMAQBANQ-1F` devienne un délai de ~300 ms au lieu d'un écran d'erreur.

**Architecture:** `db/retry-pool.ts` expose `NeonRetryPool extends Pool` (surcharge de `connect()`, promesse ET callback) + le prédicat `isNeonWakeupError`. `db/index.ts` l'instancie avec `connectionTimeoutMillis: 10_000`. Aucun autre fichier applicatif ne change.

**Tech Stack:** pg / pg-pool 3.x · Drizzle · Vitest (projet frontend).

**Spec :** `docs/superpowers/specs/2026-08-18-pool-neon-retry-design.md`
**Branche :** `fix/pool-neon-retry`

---

## Task 1 : `NeonRetryPool`

**Files:**
- Create: `db/retry-pool.ts`
- Test: `tests/db/RetryPool.test.ts` (créer)
- Modify: `db/index.ts:9`

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
import { Pool } from "pg"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NeonRetryPool, isNeonWakeupError } from "@/db/retry-pool"

const pgError = (code: string) =>
  Object.assign(new Error(`pg ${code}`), { code })

// Client minimal : seule `release` est consommée par pg-pool/drizzle.
const fakeClient = () => ({ release: vi.fn() }) as never

const makePool = () =>
  new NeonRetryPool(
    { connectionString: "postgres://test@localhost/test" },
    { backoffsMs: [0, 0] },
  )

afterEach(() => vi.restoreAllMocks())

describe("isNeonWakeupError", () => {
  it("reconnaît 53300 et 57P03, refuse le reste", () => {
    expect(isNeonWakeupError(pgError("53300"))).toBe(true)
    expect(isNeonWakeupError(pgError("57P03"))).toBe(true)
    expect(isNeonWakeupError(pgError("28P01"))).toBe(false)
    expect(isNeonWakeupError(new Error("timeout exceeded"))).toBe(false)
    expect(isNeonWakeupError(null)).toBe(false)
  })
})

describe("NeonRetryPool", () => {
  it("réussit au 3e essai quand Neon refuse deux permits", async () => {
    const client = fakeClient()
    const spy = vi
      .spyOn(Pool.prototype, "connect")
      .mockRejectedValueOnce(pgError("53300"))
      .mockRejectedValueOnce(pgError("53300"))
      .mockResolvedValueOnce(client)

    await expect(makePool().connect()).resolves.toBe(client)
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it("abandonne après épuisement des retries", async () => {
    const spy = vi
      .spyOn(Pool.prototype, "connect")
      .mockRejectedValue(pgError("53300"))

    await expect(makePool().connect()).rejects.toMatchObject({ code: "53300" })
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it("ne retente pas une erreur étrangère au réveil", async () => {
    const spy = vi
      .spyOn(Pool.prototype, "connect")
      .mockRejectedValue(pgError("28P01"))

    await expect(makePool().connect()).rejects.toMatchObject({ code: "28P01" })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("retente aussi 57P03 (database system is starting up)", async () => {
    const client = fakeClient()
    vi.spyOn(Pool.prototype, "connect")
      .mockRejectedValueOnce(pgError("57P03"))
      .mockResolvedValueOnce(client)

    await expect(makePool().connect()).resolves.toBe(client)
  })

  it("préserve le contrat callback de pg-pool après un retry", async () => {
    const client = fakeClient()
    vi.spyOn(Pool.prototype, "connect")
      .mockRejectedValueOnce(pgError("53300"))
      .mockResolvedValueOnce(client)

    const cb = vi.fn()
    makePool().connect(cb)

    await vi.waitFor(() =>
      expect(cb).toHaveBeenCalledWith(undefined, client, client.release),
    )
  })

  it("propage l'échec à la forme callback", async () => {
    vi.spyOn(Pool.prototype, "connect").mockRejectedValue(pgError("53300"))

    const cb = vi.fn()
    makePool().connect(cb)

    await vi.waitFor(() =>
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ code: "53300" })),
    )
  })
})
```

> Le stub porte sur `Pool.prototype.connect` (le `super.connect` de la
> sous-classe) : aucun réseau, aucun fake timer — les backoffs injectés valent 0.

- [ ] **Step 2 : Vérifier l'échec**

```bash
bunx vitest run --project frontend tests/db/RetryPool.test.ts
```

Attendu : ÉCHEC — `Cannot find module '@/db/retry-pool'`.

- [ ] **Step 3 : Écrire `db/retry-pool.ts`**

```ts
import { Pool, type PoolClient, type PoolConfig } from "pg"

// Codes pg émis par le proxy Neon pendant un réveil de compute : le refus de
// « permit » (53300, prouvé sur NOMAQBANQ-1F) et « the database system is
// starting up » (57P03). Ces erreurs surviennent AVANT qu'une requête soit
// envoyée : rejouer l'acquisition ne peut rien dupliquer, écritures comprises.
const NEON_WAKEUP_CODES = new Set(["53300", "57P03"])

export const isNeonWakeupError = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  NEON_WAKEUP_CODES.has(String((err as { code: unknown }).code))

const sleep = (ms: number) =>
  ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve()

type RetryOptions = {
  /** Attentes entre tentatives ; la longueur fixe le nombre de retries. */
  backoffsMs?: readonly number[]
}

type ConnectCallback = (
  err: Error | undefined,
  client?: PoolClient,
  release?: PoolClient["release"],
) => void

export class NeonRetryPool extends Pool {
  private readonly backoffsMs: readonly number[]

  constructor(config: PoolConfig, retry: RetryOptions = {}) {
    super(config)
    this.backoffsMs = retry.backoffsMs ?? [250, 1000]
  }

  private async connectWithRetry(): Promise<PoolClient> {
    for (const backoff of this.backoffsMs) {
      try {
        return await super.connect()
      } catch (err) {
        if (!isNeonWakeupError(err)) throw err
        await sleep(backoff)
      }
    }
    return super.connect()
  }

  // pg-pool appelle connect(cb) depuis pool.query (pg-pool/index.js:449) avec
  // le contrat cb(undefined, client, client.release) — à préserver à
  // l'identique, sinon toutes les requêtes one-shot de Drizzle cassent.
  override connect(): Promise<PoolClient>
  override connect(cb: ConnectCallback): void
  override connect(cb?: ConnectCallback): Promise<PoolClient> | void {
    if (!cb) return this.connectWithRetry()
    this.connectWithRetry().then(
      (client) => cb(undefined, client, client.release),
      (err: Error) => cb(err),
    )
  }
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
bunx vitest run --project frontend tests/db/RetryPool.test.ts
```

Attendu : 7 tests PASS.

- [ ] **Step 5 : Discriminance**

Dans `retry-pool.ts`, remplacer temporairement le corps de `connectWithRetry`
par `return super.connect()`. Attendu : les tests « réussit au 3e essai »,
« retente aussi 57P03 » et les deux tests callback ÉCHOUENT. Restaurer.

- [ ] **Step 6 : Brancher `db/index.ts`**

```diff
-import { Pool } from "pg"
+import { NeonRetryPool } from "@/db/retry-pool"
 …
-const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 })
+// connectionTimeoutMillis borne l'acquisition (réveil Neon lent, file du pool
+// saturé) : erreur franche à 10 s au lieu d'un blocage indéfini.
+const pool = new NeonRetryPool({
+  connectionString: env.DATABASE_URL,
+  max: 5,
+  connectionTimeoutMillis: 10_000,
+})
```

(adapter à la forme exacte du fichier ; `pool.on("error")` et
`attachDatabasePool` restent inchangés)

- [ ] **Step 7 : Gate + suites + commit**

```bash
bun run check
bun run test
bun run test:integration
git add db/ tests/db/
git commit -m "fix(db): retenter l'acquisition de connexion sur réveil Neon (53300/57P03)"
```

L'intégration valide le pool réel sur branche Neon éphémère (le retry est
transparent quand tout va bien).

## Task 2 : Règle + validation finale

**Files:**
- Modify: `.claude/rules/data-layer.md` (règle « jamais d'appel au db global »)

- [ ] **Step 1 : Mettre à jour la règle**

Dans la règle « Jamais d'appel au `db` global depuis une fonction exécutée dans
une transaction », remplacer « le pool est à `max: 5` **sans**
`connectionTimeoutMillis` (`db/index.ts`), donc réclamer une 2ᵉ connexion
pendant qu'on en détient une fige la requête indéfiniment » par :

```markdown
le pool est à `max: 5` avec `connectionTimeoutMillis: 10_000` (`db/index.ts`),
donc réclamer une 2ᵉ connexion pendant qu'on en détient une bloque 10 s puis
échoue — mieux qu'avant (blocage indéfini), mais toujours un bug à corriger à
la source. Le pool retente par ailleurs l'ACQUISITION sur les erreurs de réveil
Neon 53300/57P03 (`db/retry-pool.ts`) — sûr car aucune requête n'est encore
partie ; ne pas étendre ce retry aux requêtes elles-mêmes
```

- [ ] **Step 2 : Format + commit**

```bash
bun run format:check
git add .claude/rules/data-layer.md
git commit -m "docs(rules): pool borné à 10 s + retry d'acquisition Neon"
```

- [ ] **Step 3 : Après merge + déploiement**

`sentry issue resolve NOMAQBANQ-1F`. Signal de succès : plus de 500
« Failed query … 53300 » dans les logs Vercel aux réveils. Rappel : le trou
Sentry serveur n'étant pas encore bouché, croiser avec les logs Vercel
(rétention ~1 h), pas seulement avec Sentry.
