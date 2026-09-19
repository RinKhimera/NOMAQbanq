import { beforeEach, describe, expect, it } from "vitest"
import type * as email from "@/email"
import { fakeMailer, mailbox } from "../helpers/fake-mailer"

const VERBS: (keyof typeof email)[] = [
  "sendVerificationEmail",
  "sendResetPassword",
  "sendExamResultsEmail",
  "sendAccessExpiringEmail",
  "sendPurchaseConfirmationEmail",
  "sendWelcomeEmail",
  "sendInactivityReminderEmail",
  "sendAbandonedCartEmail",
]

beforeEach(() => mailbox.reset())

describe("faux Mailer", () => {
  it("expose exactement les huit verbes de @/email", () => {
    expect(Object.keys(fakeMailer).sort()).toEqual([...VERBS].sort())
  })

  it("enregistre le verbe et l'entrée exacte, résout un identifiant de message", async () => {
    const id = await fakeMailer.sendWelcomeEmail({
      to: "a@test.invalid",
      name: "A",
    })
    expect(typeof id).toBe("string")
    expect(mailbox.sent).toEqual([
      { verb: "sendWelcomeEmail", input: { to: "a@test.invalid", name: "A" } },
    ])
  })

  it("peut faire échouer le prochain appel d'un verbe, une seule fois", async () => {
    const boom = new Error("SES down")
    mailbox.failNext("sendWelcomeEmail", boom)
    await expect(
      fakeMailer.sendWelcomeEmail({ to: "a@test.invalid", name: "A" }),
    ).rejects.toBe(boom)
    await expect(
      fakeMailer.sendWelcomeEmail({ to: "a@test.invalid", name: "A" }),
    ).resolves.toEqual(expect.any(String))
    expect(mailbox.sent).toHaveLength(1)
  })

  it("reset vide la boîte et les échecs programmés", async () => {
    mailbox.failNext("sendWelcomeEmail", new Error("x"))
    await fakeMailer.sendResetPassword({ to: "a@test.invalid", url: "u" })
    mailbox.reset()
    expect(mailbox.sent).toEqual([])
    await expect(
      fakeMailer.sendWelcomeEmail({ to: "a@test.invalid", name: "A" }),
    ).resolves.toEqual(expect.any(String))
  })
})
