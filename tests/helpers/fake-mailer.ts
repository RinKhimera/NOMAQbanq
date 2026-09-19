import { vi } from "vitest"
import type * as email from "@/email"

/** Port Mailer : la surface exportée de `@/email`, et rien d'autre. */
export type Mailer = typeof email

export type SentMail = { verb: keyof Mailer; input: unknown }

const sent: SentMail[] = []
const failures = new Map<keyof Mailer, Error>()

/**
 * Boîte du faux : ce qui a été envoyé (verbe + entrée exacte) et de quoi faire
 * échouer le prochain appel d'un verbe. `reset()` entre deux tests.
 */
export const mailbox = {
  sent,
  failNext(verb: keyof Mailer, error: Error) {
    failures.set(verb, error)
  },
  reset() {
    sent.length = 0
    failures.clear()
  },
}

const verb = <K extends keyof Mailer>(name: K) =>
  vi.fn(async (input: Parameters<Mailer[K]>[0]): Promise<string> => {
    const failure = failures.get(name)
    if (failure) {
      failures.delete(name)
      throw failure
    }
    sent.push({ verb: name, input })
    return `ses-msg-${sent.length}`
  })

/**
 * Remplace `@/email` en test : `vi.mock("@/email", () =>
 * import("@/tests/helpers/fake-mailer").then((m) => m.fakeMailer))`.
 * `satisfies Mailer` : un verbe ajouté à `@/email` sans son faux ne compile plus.
 */
export const fakeMailer = {
  sendVerificationEmail: verb("sendVerificationEmail"),
  sendResetPassword: verb("sendResetPassword"),
  sendExamResultsEmail: verb("sendExamResultsEmail"),
  sendAccessExpiringEmail: verb("sendAccessExpiringEmail"),
  sendPurchaseConfirmationEmail: verb("sendPurchaseConfirmationEmail"),
  sendWelcomeEmail: verb("sendWelcomeEmail"),
  sendInactivityReminderEmail: verb("sendInactivityReminderEmail"),
  sendAbandonedCartEmail: verb("sendAbandonedCartEmail"),
} satisfies Mailer
