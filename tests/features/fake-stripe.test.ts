import { describe, expect, it } from "vitest"
import { fakeStripe, stripeBox } from "../helpers/fake-stripe"

// Le typecheck garantit déjà (`satisfies StripePort`) que le faux couvre le
// port ; ce test documente la surface — un verbe ajouté ou retiré se lit ici.
describe("faux Stripe", () => {
  it("expose les sept verbes du port, et rien d'autre", () => {
    expect(Object.keys(fakeStripe).sort()).toEqual([
      "createCheckoutSession",
      "createPortalSession",
      "findCheckoutSessionByPaymentIntent",
      "findCustomerByEmail",
      "listActivePrices",
      "retrieveCheckoutSession",
      "verifyWebhook",
    ])
  })

  it("sans événement posé, verifyWebhook lève (signature invalide)", async () => {
    stripeBox.reset()
    await expect(fakeStripe.verifyWebhook("{}", "sig")).rejects.toThrow(
      "signature",
    )
  })
})
