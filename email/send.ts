// Server-only. NE PAS importer depuis un composant 'use client'.
import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { render } from "@react-email/render"
import type { ReactElement } from "react"

import { env } from "@/lib/env/server"

import { getSesClient } from "./client"

export interface SendEmailInput {
  to: string
  subject: string
  react: ReactElement
}

export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailInput): Promise<string> {
  if (!env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM manquante")
  }

  // Sandbox : redirige tous les envois vers une adresse vérifiée, sujet annoté.
  const recipient = env.EMAIL_OVERRIDE_TO ?? to
  const finalSubject = env.EMAIL_OVERRIDE_TO ? `[DEV → ${to}] ${subject}` : subject

  const [html, text] = await Promise.all([
    render(react),
    render(react, { plainText: true }),
  ])

  const response = await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: env.EMAIL_FROM,
      Destination: { ToAddresses: [recipient] },
      Content: {
        Simple: {
          Subject: { Data: finalSubject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
      },
      ...(env.SES_CONFIGURATION_SET
        ? { ConfigurationSetName: env.SES_CONFIGURATION_SET }
        : {}),
    }),
  )

  return response.MessageId ?? ""
}
