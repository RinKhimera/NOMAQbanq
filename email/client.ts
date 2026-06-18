// Server-only. NE PAS importer depuis un composant 'use client'.
import { SESv2Client } from "@aws-sdk/client-sesv2"

import { env } from "@/lib/env/server"

let client: SESv2Client | undefined

export function getSesClient(): SESv2Client {
  if (!env.SES_ACCESS_KEY_ID || !env.SES_SECRET_ACCESS_KEY) {
    throw new Error("SES : SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY manquantes")
  }
  client ??= new SESv2Client({
    region: env.SES_REGION ?? "us-east-2",
    credentials: {
      accessKeyId: env.SES_ACCESS_KEY_ID,
      secretAccessKey: env.SES_SECRET_ACCESS_KEY,
    },
  })
  return client
}
