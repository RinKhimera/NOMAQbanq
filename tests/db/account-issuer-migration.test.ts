import { createLocalAccountIssuer } from "@better-auth/core/db"
import { google } from "@better-auth/core/social-providers"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// Le rétro-remplissage de `account.issuer` est figé dans une migration SQL,
// alors que les valeurs attendues au runtime viennent de better-auth. Ce test
// épingle les CONSTANTES de la bibliothèque installée (préfixe local, issuer
// déclaré par le fournisseur Google) : il casse si une montée les change. Il ne
// voit PAS un changement de la RÉSOLUTION (une future `identityStrategy` qui
// contournerait `accountIssuer`) — le résolveur n'est pas exporté ; c'est la
// règle `ignore` de .github/dependabot.yml qui force une relecture humaine des
// mineures de better-auth.
const migration = readFileSync(
  resolve(process.cwd(), "drizzle/0016_account_issuer.sql"),
  "utf8",
)

describe("migration 0016 — émetteurs des comptes existants", () => {
  it("remplit les comptes mot de passe avec l'émetteur local de better-auth", () => {
    expect(migration).toContain(
      `SET "issuer" = '${createLocalAccountIssuer("credential")}' WHERE "provider_id" = 'credential'`,
    )
  })

  it("remplit les comptes Google avec l'émetteur déclaré par le fournisseur", () => {
    const provider = google({ clientId: "id", clientSecret: "secret" })
    expect(migration).toContain(
      `SET "issuer" = '${provider.accountIssuer}' WHERE "provider_id" = 'google'`,
    )
  })

  it("refuse une ligne credential dont account_id diverge de user_id", () => {
    expect(migration).toMatch(
      /RAISE EXCEPTION[\s\S]*"provider_id" = 'credential' AND "account_id" <> "user_id"|"provider_id" = 'credential' AND "account_id" <> "user_id"[\s\S]*RAISE EXCEPTION/,
    )
  })

  it("rend la colonne obligatoire et unique par (issuer, account_id)", () => {
    expect(migration).toContain(
      `ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL`,
    )
    expect(migration).toContain(
      `CREATE UNIQUE INDEX "account_issuer_account_id_uidx" ON "account" USING btree ("issuer","account_id")`,
    )
  })
})
