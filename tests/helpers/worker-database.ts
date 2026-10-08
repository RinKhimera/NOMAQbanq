import { Client } from "pg"
import { TEST_DATABASE } from "../../scripts/test-postgres"

/**
 * Base neuve pour le fichier de test courant, clonée de la base migrée par
 * l'orchestrateur (`CREATE DATABASE … TEMPLATE`). Une base par worker vitest,
 * recréée à chaque fichier : aucun fichier ne voit les lignes d'un autre, ni
 * en parallèle ni en séquence.
 */
export const cloneTestDatabase = async (serverUrl: URL): Promise<string> => {
  const name = `${TEST_DATABASE}_w${process.env.VITEST_POOL_ID ?? "0"}`

  const admin = new Client({
    connectionString: new URL("/postgres", serverUrl).href,
  })
  await admin.connect()
  try {
    // FORCE : le pool du fichier précédent de ce worker peut garder des
    // connexions inactives ouvertes.
    await admin.query(`drop database if exists "${name}" with (force)`)
    await admin.query(`create database "${name}" template "${TEST_DATABASE}"`)
  } finally {
    await admin.end()
  }

  return new URL(`/${name}`, serverUrl).href
}
