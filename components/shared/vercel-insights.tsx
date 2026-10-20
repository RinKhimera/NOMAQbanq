"use client"

import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import {
  analyticsBeforeSend,
  speedInsightsBeforeSend,
} from "@/lib/vercel-insights"

// Client parce qu'un `beforeSend` est une fonction, que le layout racine
// (Server Component) ne peut pas passer en prop.
export function VercelInsights() {
  return (
    <>
      <Analytics beforeSend={analyticsBeforeSend} />
      {/* Sans l'option Plus : 10 000 mesures sur 30 jours glissants, collecte
          suspendue au moins 14 jours au-delà. À 50 %, la limite tient
          ~4 000 visites au lieu de ~2 000. */}
      <SpeedInsights beforeSend={speedInsightsBeforeSend} sampleRate={0.5} />
    </>
  )
}
