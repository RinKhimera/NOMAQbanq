import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  sendAccessExpiringEmail,
  sendExamResultsEmail,
  sendPurchaseConfirmationEmail,
  sendResetPassword,
  sendVerificationEmail,
} from "@/email"

const { sendEmailSpy } = vi.hoisted(() => ({ sendEmailSpy: vi.fn() }))
vi.mock("@/email/send", () => ({ sendEmail: sendEmailSpy }))
vi.mock("@/lib/base-url", () => ({ getBaseUrl: () => "https://nomaqbanq.ca" }))
vi.mock("@/lib/env/server", () => ({
  env: { SUPPORT_EMAIL: "support@nomaqbanq.ca" },
}))

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

describe("sendPurchaseConfirmationEmail", () => {
  // Intl fr-CA sépare avec des espaces insécables (U+00A0 / U+202F) : on
  // normalise avant de comparer.
  const plain = (s: string) => s.replace(/[  ]/g, " ")

  it("formate montants, dates et accès en français", async () => {
    const messageId = await sendPurchaseConfirmationEmail({
      to: "u@x.com",
      productName: "Accès examens",
      amountPaid: 20000,
      currency: "CAD",
      presentmentAmount: 9120000,
      presentmentCurrency: "XAF",
      purchasedAt: new Date("2026-09-02T14:00:00Z"),
      grantedAccess: [
        { accessType: "exam", expiresAt: new Date("2026-12-31T14:00:00Z") },
        { accessType: "training", expiresAt: new Date("2026-10-02T14:00:00Z") },
      ],
    })
    expect(messageId).toBe("msg-1")
    const arg = firstArg()
    expect(arg.to).toBe("u@x.com")
    expect(arg.subject).toBe("Confirmation de votre achat — NOMAQbanq")
    const props = (arg.react as { props: Record<string, unknown> }).props
    expect(plain(props.amountLabel as string)).toBe("200 $")
    expect(plain(props.presentmentLabel as string).replace(/ /g, "")).toContain(
      "9120000",
    )
    expect(props.purchasedAtLabel).toBe("2 septembre 2026")
    expect(props.grantedAccess).toEqual([
      { label: "Accès aux examens", expiresAtLabel: "31 décembre 2026" },
      { label: "Accès à l'entraînement", expiresAtLabel: "2 octobre 2026" },
    ])
    expect(props.accountUrl).toBe(
      "https://nomaqbanq.ca/tableau-de-bord/abonnements",
    )
    expect(props.supportEmail).toBe("support@nomaqbanq.ca")
  })

  it("sans montant local → presentmentLabel null", async () => {
    await sendPurchaseConfirmationEmail({
      to: "u@x.com",
      productName: "Accès examens",
      amountPaid: 20000,
      currency: "CAD",
      presentmentAmount: null,
      presentmentCurrency: null,
      purchasedAt: new Date("2026-09-02T14:00:00Z"),
      grantedAccess: [
        { accessType: "exam", expiresAt: new Date("2026-12-01T14:00:00Z") },
      ],
    })
    const props = (firstArg().react as { props: Record<string, unknown> }).props
    expect(props.presentmentLabel).toBeNull()
  })
})
