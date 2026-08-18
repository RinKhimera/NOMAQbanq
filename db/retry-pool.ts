import { Pool, type PoolClient, type PoolConfig } from "pg"

// Codes pg émis par le proxy Neon pendant un réveil de compute : le refus de
// « permit » (53300) et « the database system is starting up » (57P03). Ces
// erreurs surviennent AVANT qu'une requête soit envoyée : rejouer l'acquisition
// ne peut rien dupliquer, écritures comprises. Ne pas étendre ce retry aux
// requêtes elles-mêmes — lui seul est inconditionnellement idempotent.
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

  // `pool.query` (donc toute requête Drizzle one-shot) passe par la forme
  // callback avec le contrat cb(undefined, client, client.release)
  // (pg-pool/index.js:449) — à préserver à l'identique.
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
