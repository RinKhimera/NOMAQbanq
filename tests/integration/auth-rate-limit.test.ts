import { describe, expect, it } from "vitest"
import { auth } from "@/lib/auth"

// Le limiteur n'est actif qu'en production : aucun test ne peut observer son
// effet, donc on verrouille la configuration. L'en-tête de chaque page publique
// appelle `/get-session`, visiteurs anonymes et robots compris ; limité en
// stockage `database`, chaque appel écrirait dans `rate_limit` et réveillerait
// Neon.
describe("rate limit de better-auth", () => {
  it("exempte /get-session", () => {
    expect(auth.options.rateLimit?.customRules?.["/get-session"]).toBe(false)
  })

  it("garde les routes qui envoient des courriels sous limite", () => {
    const rules = auth.options.rateLimit?.customRules
    expect(rules?.["/request-password-reset"]).toEqual({ window: 60, max: 3 })
    expect(rules?.["/send-verification-email"]).toEqual({ window: 60, max: 3 })
  })
})
