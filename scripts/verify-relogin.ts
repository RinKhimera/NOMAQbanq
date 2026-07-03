// Spike (jetable) : vérifie empiriquement le chemin de re-login email/mdp d'un
// utilisateur MIGRÉ (emailVerified=true, AUCUNE ligne `account`) sur la branche develop.
// Question (audit B5) : `resetPassword` crée-t-il un account `credential` pour un user
// qui n'en a pas ? Testé sur un user synthétique de même forme (pas de PII réelle).
//
// Sous-commandes :
//   bun run scripts/verify-relogin.ts request <email>            # envoie un reset (token -> table verification)
//   bun run scripts/verify-relogin.ts confirm <token> <newPwd>   # applique le reset
//   bun run scripts/verify-relogin.ts signin  <email> <pwd>      # tente la connexion
//
// dotenv charge .env.local AVANT l'import dynamique de @/lib/auth (sinon l'import statique,
// hoisté, lirait process.env avant que les vars soient présentes → loadServerEnv throw).
import { config } from "dotenv"

config({ path: ".env.local" })

async function main() {
  const { auth } = await import("@/lib/auth")
  const [, , cmd, arg1, arg2] = process.argv

  switch (cmd) {
    case "request": {
      if (!arg1) throw new Error("usage: request <email>")
      await auth.api.requestPasswordReset({
        body: { email: arg1, redirectTo: "/reinitialiser-mot-de-passe" },
      })
      console.log(`[request] OK pour ${arg1}`)
      console.log(
        "[next] token via MCP : SELECT identifier, value FROM verification ORDER BY created_at DESC LIMIT 3;",
      )
      return
    }
    case "confirm": {
      if (!arg1 || !arg2)
        throw new Error("usage: confirm <token> <newPassword>")
      await auth.api.resetPassword({ body: { token: arg1, newPassword: arg2 } })
      console.log("[confirm] resetPassword OK")
      return
    }
    case "signin": {
      if (!arg1 || !arg2) throw new Error("usage: signin <email> <password>")
      const res = await auth.api.signInEmail({
        body: { email: arg1, password: arg2 },
      })
      console.log(
        "[signin] OK — user.id:",
        res.user.id,
        "email:",
        res.user.email,
      )
      return
    }
    default:
      throw new Error("commande inconnue : request | confirm | signin")
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[FAIL]", e?.message ?? e)
    process.exit(1)
  })
