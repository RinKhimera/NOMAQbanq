// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// Jamais chargé depuis Next 16 : `proxy.ts` tourne en runtime Node et aucune
// route ne déclare `runtime = "edge"` (`instrumentation.ts` ne l'importe que
// pour NEXT_RUNTIME=edge). Aligné sur le serveur pour éviter une divergence
// latente si un runtime edge revenait.
import * as Sentry from "@sentry/nextjs"
import { serverTracesSampler } from "@/lib/sentry-sampling"

Sentry.init({
  dsn: "https://c7c726531f3e9dc07a6488f3bd7ae9b4@o4510410010787842.ingest.us.sentry.io/4510410016227333",

  // Dev local et e2e (y compris le build prod du chemin CI, via le kill-switch)
  // ne doivent jamais polluer le projet Sentry de prod.
  enabled:
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SENTRY_DISABLED !== "1",
  environment: process.env.VERCEL_ENV ?? "development",

  // Webhook Stripe et cron à 100 %, le reste hérite du client ou 10 % : chaque
  // span coûte du CPU actif Vercel sur CHAQUE invocation (`lib/sentry-sampling.ts`).
  tracesSampler: serverTracesSampler,

  // Aucun émetteur de log Sentry dans le code : option fermée, sans gain attendu.
  enableLogs: false,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
})
