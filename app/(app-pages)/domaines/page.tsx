"use client"

import DomainesCTA from "./_components/DomainesCTA"
import DomainesHeader from "./_components/DomainesHeader"
import DomainesStats from "./_components/DomainesStats"
import DomainsGrid from "./_components/DomainsGrid"

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
