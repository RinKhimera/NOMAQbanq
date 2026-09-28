"use client"

import DomainCard from "@/components/marketing/domain-card"
import { getDomainMetadata } from "@/data/domain-metadata"
import type { MarketingStats } from "@/features/marketing/dal"

export default function DomainsGrid({ stats }: { stats: MarketingStats }) {
  const topDomains = stats.topDomains
  const remainingCount = stats.totalDomains - topDomains.length

  return (
    <div className="mb-20">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {topDomains.map((domainStat) => {
          const metadata = getDomainMetadata(domainStat.domain)
          return (
            <div key={domainStat.domain}>
              <DomainCard
                domain={{
                  title: domainStat.domain,
                  description: metadata.description,
                  icon: metadata.icon,
                  questionsCount: domainStat.count,
                  slug: metadata.slug,
                }}
              />
            </div>
          )
        })}
      </div>

      {remainingCount > 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            Et{" "}
            <span className="font-semibold text-blue-600">
              {remainingCount} autres domaines
            </span>{" "}
            disponibles sur la plateforme
          </p>
        </div>
      )}
    </div>
  )
}
