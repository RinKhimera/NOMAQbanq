import { vi } from "vitest"

/**
 * Faux `db` Drizzle pour les tests d'actions : chaque méthode de la chaîne se
 * renvoie elle-même et l'objet est « thenable », donc `await` fonctionne quel
 * que soit le maillon terminal (`.limit()`, `.where()`, `.values()`…). Les
 * lignes servies sont indexées par NOM DE TABLE, ce qui rend les tests
 * indépendants de l'ordre des requêtes dans l'action.
 *
 * Usage : `vi.mock("@/db", async () => ({ db: (await import("../helpers/fake-drizzle")).fakeDb }))`
 * et `vi.mock("@/db/schema", …)` avec `table(name)` pour chaque table lue.
 */
export const state = {
  rows: {} as Record<string, unknown[]>,
  returning: [] as unknown[],
  /** Dernier payload passé à `.set(...)`. */
  set: undefined as unknown,
  transaction:
    vi.fn<(cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(),
}

export const table = (name: string) => ({ __table: name })

const queryChain = (initialTable?: string) => {
  let target = initialTable
  const chain: Record<string, unknown> = {
    from: (t: { __table?: string }) => {
      target = t?.__table
      return chain
    },
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    for: () => chain,
    limit: () => chain,
    set: (payload: unknown) => {
      state.set = payload
      return chain
    },
    values: () => chain,
    onConflictDoNothing: () => chain,
    onConflictDoUpdate: () => chain,
    returning: () => Promise.resolve(state.returning),
    then: (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) =>
      Promise.resolve((target ? state.rows[target] : undefined) ?? []).then(
        onOk,
        onErr,
      ),
  }
  return chain
}

export const fakeDb = {
  transaction: (cb: (tx: unknown) => Promise<unknown>) => state.transaction(cb),
  execute: vi.fn(async () => ({ rows: [] })),
  select: () => queryChain(),
  insert: (t: { __table?: string }) => queryChain(t?.__table),
  update: (t: { __table?: string }) => queryChain(t?.__table),
  delete: (t: { __table?: string }) => queryChain(t?.__table),
}

/**
 * Le `tx` reçu par le callback de transaction : mêmes méthodes que `fakeDb`,
 * identité DISTINCTE, pour qu'une assertion « appelé avec la transaction »
 * distingue `tx` du `db` global (règle data-layer : jamais le `db` global
 * sous transaction).
 */
export const fakeTx = { ...fakeDb, __tx: true as const }

export const setRows = (rows: Record<string, unknown[]>) => {
  state.rows = rows
}

/** Exécute réellement le callback de transaction contre le faux `db`. */
export const runCallback = () =>
  state.transaction.mockImplementationOnce(async (cb) => cb(fakeTx))

/** Fait échouer le corps de la transaction avec un code métier. */
export const rejectWith = (message: string) =>
  state.transaction.mockRejectedValueOnce(new Error(message))

/** À appeler dans `beforeEach`. */
export const resetFakeDrizzle = (returning: unknown[] = []) => {
  state.rows = {}
  state.returning = returning
  state.set = undefined
  state.transaction.mockReset()
  state.transaction.mockImplementation(async (cb) => cb(fakeTx))
}
