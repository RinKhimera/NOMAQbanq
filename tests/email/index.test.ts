import { beforeEach, describe, expect, it, vi } from "vitest"

const { sendEmailSpy } = vi.hoisted(() => ({ sendEmailSpy: vi.fn() }))
vi.mock("@/email/send", () => ({ sendEmail: sendEmailSpy }))

import { sendResetPassword, sendVerificationEmail } from "@/email"

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
})
