// Server-only. NE PAS importer depuis un composant 'use client'.
import { SESv2Client } from "@aws-sdk/client-sesv2"
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider"

import { env } from "@/lib/env/server"

let client: SESv2Client | undefined

// Identifiants selon l'environnement :
// - Prod (Vercel) : fédération OIDC via AWS_ROLE_ARN → identifiants temporaires, aucun secret stocké.
// - Local/dev : clés statiques scopées `ses:SendEmail`.
function resolveCredentials() {
  if (env.AWS_ROLE_ARN) {
    return awsCredentialsProvider({ roleArn: env.AWS_ROLE_ARN })
  }
  if (env.SES_ACCESS_KEY_ID && env.SES_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: env.SES_ACCESS_KEY_ID,
      secretAccessKey: env.SES_SECRET_ACCESS_KEY,
    }
  }
  throw new Error(
    "SES : aucun identifiant — définir AWS_ROLE_ARN (OIDC Vercel) ou SES_ACCESS_KEY_ID/SES_SECRET_ACCESS_KEY (local)",
  )
}

export function getSesClient(): SESv2Client {
  client ??= new SESv2Client({
    region: env.SES_REGION ?? "us-east-2",
    credentials: resolveCredentials(),
  })
  return client
}
