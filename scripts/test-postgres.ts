/**
 * Cycle de vie du Postgres jetable des tests d'intégration : un conteneur
 * Docker `postgres:18` par run, sur un port hôte aléatoire, supprimé à l'arrêt
 * (`--rm`). Même chemin en local (Docker Desktop) et en CI (runner ubuntu).
 *
 * L'image officielle est tirée du miroir ECR Public d'AWS, pas de Docker Hub :
 * les runners GitHub partagent leurs IP, et Docker Hub y épuise son quota de
 * tirages anonymes (`toomanyrequests`) au point de faire échouer le CI.
 */
import { spawnSync } from "node:child_process"

const IMAGE = "public.ecr.aws/docker/library/postgres:18"
const LABEL = "nomaq-test"
const CREATED_LABEL = `${LABEL}.created`
const STALE_AFTER_MS = 60 * 60 * 1000
const READY_TIMEOUT_MS = 60_000

export const TEST_DATABASE = "nomaq_test"

export type TestPostgres = { name: string; url: string }

const docker = (args: string[]): string => {
  const res = spawnSync("docker", args, { encoding: "utf8" })
  if (res.error) {
    throw new Error(
      `Docker introuvable (${res.error.message}) : installez et lancez Docker Desktop.`,
    )
  }
  if (res.status !== 0) {
    throw new Error(`docker ${args[0]} a échoué : ${res.stderr.trim()}`)
  }
  return res.stdout.trim()
}

/**
 * Supprime les conteneurs de test de plus d'une heure (crash, Ctrl+C ou
 * --keep oublié). Pas les plus récents : une autre session peut être en train
 * de s'en servir.
 */
export const removeStaleTestContainers = (): string[] => {
  const cutoff = Date.now() - STALE_AFTER_MS
  const stale = docker([
    "ps",
    "-a",
    "--filter",
    `label=${LABEL}`,
    "--format",
    `{{.Names}} {{.Label "${CREATED_LABEL}"}}`,
  ])
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(" "))
    .filter(([, created]) => Number(created) < cutoff)
    .map(([name]) => name)
  if (stale.length > 0) docker(["rm", "--force", "--volumes", ...stale])
  return stale
}

/**
 * `pg_isready` par TCP, depuis le conteneur : pendant son initialisation,
 * l'image lance un serveur temporaire joignable seulement par socket Unix, qui
 * répondrait « prêt » avant le serveur définitif.
 */
const waitUntilReady = async (name: string): Promise<void> => {
  const deadline = Date.now() + READY_TIMEOUT_MS
  for (;;) {
    const probe = spawnSync("docker", [
      "exec",
      name,
      "pg_isready",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      TEST_DATABASE,
    ])
    if (probe.status === 0) return
    if (Date.now() > deadline) {
      throw new Error(`Postgres (${name}) toujours injoignable après 60 s.`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }
}

export const startTestPostgres = async (): Promise<TestPostgres> => {
  const name = `${LABEL}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  docker([
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--label",
    LABEL,
    "--label",
    `${CREATED_LABEL}=${Date.now()}`,
    // Sans mot de passe : le port n'est publié que sur la boucle locale.
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "--env",
    `POSTGRES_DB=${TEST_DATABASE}`,
    // Même collation que Neon : un ORDER BY sur du texte accentué ne trie pas
    // pareil sous en_US.utf8, le défaut de l'image.
    "--env",
    "POSTGRES_INITDB_ARGS=--locale-provider=builtin --locale=C.UTF-8",
    // Données en mémoire : rien n'atterrit dans un volume anonyme.
    "--tmpfs",
    "/var/lib/postgresql",
    "--publish",
    "127.0.0.1::5432",
    IMAGE,
    // Base jetable : la durabilité ne sert à rien, la latence d'écriture si.
    "-c",
    "fsync=off",
    "-c",
    "synchronous_commit=off",
    "-c",
    "full_page_writes=off",
    // Une base par worker vitest, chacune avec son pool : le défaut (100) est
    // à portée d'une machine à 16 cœurs.
    "-c",
    "max_connections=200",
  ])
  try {
    await waitUntilReady(name)
    const hostPort = docker(["port", name, "5432/tcp"]).split("\n")[0]
    const port = hostPort.slice(hostPort.lastIndexOf(":") + 1)
    return {
      name,
      url: `postgresql://postgres@127.0.0.1:${port}/${TEST_DATABASE}`,
    }
  } catch (error) {
    stopTestPostgres(name)
    throw error
  }
}

/**
 * Sans `throw` : appelé depuis un `catch` ou un `finally`, il masquerait
 * l'erreur d'origine (conteneur déjà parti avec `--rm` après un crash).
 */
export const stopTestPostgres = (name: string): void => {
  const res = spawnSync("docker", ["rm", "--force", "--volumes", name], {
    encoding: "utf8",
  })
  if (res.status !== 0) {
    console.warn(
      `[test-postgres] suppression de ${name} impossible : ${res.stderr?.trim() || res.error?.message}`,
    )
  }
}
