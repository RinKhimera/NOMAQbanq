"use client"

import DomainesCTA from "./_components/domaines-cta"
import DomainesHeader from "./_components/domaines-header"
import DomainesStats from "./_components/domaines-stats"
import DomainsGrid from "./_components/domains-grid"

export default function DomainesPage() {
  return (
    <div className="theme-bg">
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <DomainesHeader />
        <DomainesStats />
        <DomainsGrid />
        <DomainesCTA />
      </div>
    </div>
  )
}
