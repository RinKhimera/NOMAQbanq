// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs"
import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-data-collection"
import { serverTracesSampler } from "@/lib/sentry-sampling"

Sentry.init({
  dsn: "https://c7c726531f3e9dc07a6488f3bd7ae9b4@o4510410010787842.ingest.us.sentry.io/4510410016227333",

  // Dev local et e2e (y compris le build prod du chemin CI, via le kill-switch)
  // ne doivent jamais polluer le projet Sentry de prod.
  enabled:
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SENTRY_DISABLED !== "1",
  environment: process.env.VERCEL_ENV ?? "development",

  // Webhook Stripe et cron à 100 % (reconnus à leur chemin, pas au nom du span,
  // encore inconnu à l'échantillonnage), le reste hérite du client ou 10 % :
  // chaque span coûte du CPU actif Vercel sur CHAQUE invocation
  // (`lib/sentry-sampling.ts`).
  tracesSampler: serverTracesSampler,

  dataCollection: SENTRY_DATA_COLLECTION,
})
