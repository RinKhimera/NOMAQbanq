import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  sendAccessExpiringEmail,
  sendExamResultsEmail,
  sendResetPassword,
  sendVerificationEmail,
} from "@/email"

const { sendEmailSpy } = vi.hoisted(() => ({ sendEmailSpy: vi.fn() }))
vi.mock("@/email/send", () => ({ sendEmail: sendEmailSpy }))

interface Arg {
  to: string
  subject: string
  react: unknown
}
const firstArg = () => sendEmailSpy.mock.calls[0]?.[0] as Arg

beforeEach(() => {
  sendEmailSpy.mockReset().mockResolvedValue("msg-1")
})

describe("email domain helpers", () => {
  it("sendVerificationEmail uses the verification subject and a template element", async () => {
    await sendVerificationEmail({ to: "u@x.com", url: "https://x/v" })
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    const arg = firstArg()
    expect(arg.to).toBe("u@x.com")
    expect(arg.subject).toContain("Vérifiez votre adresse")
    expect(arg.react).toBeTruthy()
  })

  it("sendResetPassword uses the reset subject", async () => {
    await sendResetPassword({ to: "u@x.com", url: "https://x/r" })
    expect(firstArg().subject).toContain("Réinitialisation")
    expect(firstArg().react).toBeTruthy()
  })

  it("sendExamResultsEmail met le titre de l'examen dans le sujet", async () => {
    await sendExamResultsEmail({
      to: "u@x.com",
      examTitle: "Examen A",
      score: 80,
      resultUrl: "https://x/resultats",
    })
    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    const arg = firstArg()
    expect(arg.to).toBe("u@x.com")
    expect(arg.subject).toContain("Examen A")
    expect(arg.react).toBeTruthy()
  })

  it("sendAccessExpiringEmail adapte le libellé selon le type d'accès", async () => {
    await sendAccessExpiringEmail({
      to: "u@x.com",
      accessType: "training",
      daysRemaining: 3,
      renewUrl: "https://x/abonnements",
    })
    expect(firstArg().subject).toContain("à l'entraînement")
    expect(firstArg().react).toBeTruthy()
  })
})
