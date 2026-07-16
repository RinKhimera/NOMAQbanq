"use client"

import type { MarketingStats } from "@/features/marketing/dal"
import DomainesCTA from "./domaines-cta"
import DomainesHeader from "./domaines-header"
import DomainesStats from "./domaines-stats"
import DomainsGrid from "./domains-grid"

export default function DomainesPageClient({
  stats,
}: {
  stats: MarketingStats
}) {
  return (
    <div className="theme-bg">
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <DomainesHeader />
        <DomainesStats stats={stats} />
        <DomainsGrid stats={stats} />
        <DomainesCTA />
      </div>
    </div>
  )
}
