"use client"

import DomainesCTA from "./_components/DomainesCTA"
import DomainesHeader from "./_components/DomainesHeader"
import DomainesStats from "./_components/DomainesStats"
import DomainsGrid from "./_components/DomainsGrid"

export default function DomainesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-24 pb-20 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <DomainesHeader />
        <DomainesStats />
        <DomainsGrid />
        <DomainesCTA />
      </div>
    </div>
  )
}
