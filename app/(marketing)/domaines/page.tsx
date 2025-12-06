"use client"

import DomainesCTA from "./_components/domaines-cta"
import DomainesHeader from "./_components/domaines-header"
import DomainesStats from "./_components/domaines-stats"
import DomainsGrid from "./_components/domains-grid"

export default function DomainesPage() {
  return (
    <div className="theme-bg min-h-screen pt-20">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <DomainesHeader />
        <DomainesStats />
        <DomainsGrid />
        <DomainesCTA />
      </div>
    </div>
  )
}
