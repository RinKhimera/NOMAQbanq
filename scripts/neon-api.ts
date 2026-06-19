/**
 * Client REST minimal pour l'API Neon v2 — cycle de vie des branches de test
 * jetables (tests d'intégration DAL/Actions). La clé API n'est jamais loggée.
 * Smoke test manuel : `bun scripts/neon-api.ts --smoke`.
 *
 * Env requis : NEON_API_KEY, NEON_PROJECT_ID (.env.local en local, secrets en CI).
 */
import { config } from "dotenv"

config({ path: ".env.local" })

const API_BASE = "https://console.neon.tech/api/v2"
const STALE_AFTER_MS = 60 * 60 * 1000
const PARENT_BRANCH = "develop"

type NeonBranchInfo = { id: string; name: string; created_at: string }
type NeonOperation = { id: string; status: string }

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} manquante (.env.local en local, secret en CI).`)
  return value
}

const projectId = () => requiredEnv("NEON_PROJECT_ID")

const api = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requiredEnv("NEON_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    throw new Error(`Neon API ${method} ${path} → HTTP ${res.status} : ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

const waitForOperations = async (operations: NeonOperation[] | undefined): Promise<void> => {
  const deadline = Date.now() + 120_000
  for (const op of operations ?? []) {
    for (;;) {
      const { operation } = await api<{ operation: NeonOperation }>(
        "GET",
        `/projects/${projectId()}/operations/${op.id}`,
      )
      if (operation.status === "finished") break
      if (["failed", "error", "cancelled", "skipped"].includes(operation.status)) {
        throw new Error(`Opération Neon ${op.id} en état « ${operation.status} ».`)
      }
      if (Date.now() > deadline) throw new Error("Timeout (120 s) en attendant Neon.")
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

export const listBranches = async (): Promise<NeonBranchInfo[]> => {
  const { branches } = await api<{ branches: NeonBranchInfo[] }>(
    "GET",
    `/projects/${projectId()}/branches`,
  )
  return branches
}

export type TestBranch = {
  id: string
  name: string
  connectionUri: string
  host: string
}

export const createTestBranch = async (): Promise<TestBranch> => {
  const parent = (await listBranches()).find((b) => b.name === PARENT_BRANCH)
  if (!parent) {
    throw new Error(`Branche parente « ${PARENT_BRANCH} » introuvable dans le projet Neon.`)
  }

  const name = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const created = await api<{
    branch: NeonBranchInfo
    operations: NeonOperation[]
    connection_uris?: Array<{ connection_uri: string }>
  }>("POST", `/projects/${projectId()}/branches`, {
    branch: { parent_id: parent.id, name },
    endpoints: [{ type: "read_write" }],
  })
  await waitForOperations(created.operations)

  const connectionUri = created.connection_uris?.[0]?.connection_uri
  if (!connectionUri) throw new Error("Réponse Neon sans connection_uri.")
  return { id: created.branch.id, name, connectionUri, host: new URL(connectionUri).host }
}

export const deleteBranch = async (branchId: string): Promise<void> => {
  const res = await api<{ operations: NeonOperation[] }>(
    "DELETE",
    `/projects/${projectId()}/branches/${branchId}`,
  )
  await waitForOperations(res.operations)
}

/** Supprime les branches test-* de plus d'une heure (crash ou --keep oublié). */
export const cleanupStaleTestBranches = async (): Promise<string[]> => {
  const cutoff = Date.now() - STALE_AFTER_MS
  const stale = (await listBranches()).filter(
    (b) => b.name.startsWith("test-") && new Date(b.created_at).getTime() < cutoff,
  )
  for (const b of stale) await deleteBranch(b.id)
  return stale.map((b) => b.name)
}

const isDirectRun = process.argv[1]?.endsWith("neon-api.ts") ?? false
if (isDirectRun && process.argv.includes("--smoke")) {
  const removed = await cleanupStaleTestBranches()
  if (removed.length > 0) console.log(`orphelines supprimées : ${removed.join(", ")}`)
  const branch = await createTestBranch()
  console.log(`créée : ${branch.name} | host : ${branch.host}`)
  await deleteBranch(branch.id)
  console.log("supprimée — cycle de vie OK.")
}
