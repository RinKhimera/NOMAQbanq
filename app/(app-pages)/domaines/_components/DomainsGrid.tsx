"use client"

import DomainCard from "@/components/domain-card"
import { domains } from "@/data/domains"

export default function DomainsGrid() {
  return (
    <div className="mb-20 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
      {domains.map((domain, index) => (
        <div
          key={domain.id}
          className="animate-fade-in-scale"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <DomainCard domain={domain} />
        </div>
      ))}
    </div>
  )
}
