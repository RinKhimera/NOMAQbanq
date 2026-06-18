import { createElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { sendEmail } from "@/email/send"

const { sendSpy, renderSpy, commandSpy } = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  renderSpy: vi.fn(),
  commandSpy: vi.fn(),
}))
const { envMock } = vi.hoisted(() => ({
  envMock: { current: {} as Record<string, string | undefined> },
}))

vi.mock("@/email/client", () => ({ getSesClient: () => ({ send: sendSpy }) }))
vi.mock("@react-email/render", () => ({ render: renderSpy }))
vi.mock("@/lib/env/server", () => ({
  get env() {
    return envMock.current
  },
}))
vi.mock("@aws-sdk/client-sesv2", () => ({
  SendEmailCommand: class {
    constructor(input: unknown) {
      commandSpy(input)
    }
  },
}))

interface SesInput {
  FromEmailAddress: string
  Destination: { ToAddresses: string[] }
  Content: {
    Simple: {
      Subject: { Data: string }
      Body: { Html: { Data: string }; Text: { Data: string } }
    }
  }
  ConfigurationSetName?: string
}

const react = createElement("div", null, "x")
const lastInput = () => commandSpy.mock.calls[0]?.[0] as SesInput

beforeEach(() => {
  sendSpy.mockReset().mockResolvedValue({ MessageId: "msg-123" })
  renderSpy
    .mockReset()
    .mockImplementation((_el: unknown, opts?: { plainText?: boolean }) =>
      Promise.resolve(opts?.plainText ? "texte brut" : "<p>html</p>"),
    )
  commandSpy.mockReset()
  envMock.current = { EMAIL_FROM: "NOMAQbanq <noreply@nomaqbanq.ca>" }
})

describe("sendEmail", () => {
  it("builds the SES command with HTML and text bodies", async () => {
    const id = await sendEmail({ to: "user@example.com", subject: "Sujet", react })
    expect(id).toBe("msg-123")
    const input = lastInput()
    expect(input.FromEmailAddress).toBe("NOMAQbanq <noreply@nomaqbanq.ca>")
    expect(input.Destination.ToAddresses).toEqual(["user@example.com"])
    expect(input.Content.Simple.Subject.Data).toBe("Sujet")
    expect(input.Content.Simple.Body.Html.Data).toBe("<p>html</p>")
    expect(input.Content.Simple.Body.Text.Data).toBe("texte brut")
    expect(input.ConfigurationSetName).toBeUndefined()
  })

  it("includes ConfigurationSetName only when set", async () => {
    envMock.current.SES_CONFIGURATION_SET = "nomaqbanq-transactional"
    await sendEmail({ to: "user@example.com", subject: "Sujet", react })
    expect(lastInput().ConfigurationSetName).toBe("nomaqbanq-transactional")
  })

  it("redirects to EMAIL_OVERRIDE_TO and annotates the subject", async () => {
    envMock.current.EMAIL_OVERRIDE_TO = "dixiades@gmail.com"
    await sendEmail({ to: "real@user.com", subject: "Sujet", react })
    const input = lastInput()
    expect(input.Destination.ToAddresses).toEqual(["dixiades@gmail.com"])
    expect(input.Content.Simple.Subject.Data).toBe("[DEV → real@user.com] Sujet")
  })

  it("throws when EMAIL_FROM is missing", async () => {
    envMock.current = {}
    await expect(
      sendEmail({ to: "user@example.com", subject: "Sujet", react }),
    ).rejects.toThrow(/EMAIL_FROM/)
  })
})
