"use client"

import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { chipClass } from "@/components/marketing/chip"
import { SearchInput } from "@/components/shared/search-input"
import { DOMAINS, DOMAIN_GROUPS, type DomainGroupId } from "@/constants/domains"

const ALL = "all"

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Grille des 22 domaines, filtrable par nom et par groupe. */
export const DomainsBrowser = () => {
  const [query, setQuery] = useState("")
  const [group, setGroup] = useState<DomainGroupId | typeof ALL>(ALL)

  const needle = normalize(query.trim())
  const groups = DOMAIN_GROUPS.filter((g) => group === ALL || g.id === group)
    .map((g) => ({
      ...g,
      domains: DOMAINS.filter(
        (d) =>
          d.group.id === g.id &&
          normalize(`${d.name} ${d.description}`).includes(needle),
      ),
    }))
    .filter((g) => g.domains.length > 0)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Rechercher un domaine"
          containerClassName="w-full max-w-95 flex-[1_1_280px]"
          className="max-md:h-11"
        />
        <div
          role="group"
          aria-label="Groupes de domaines"
          className="flex flex-wrap gap-1.5"
        >
          {[{ id: ALL, label: "Tous" } as const, ...DOMAIN_GROUPS].map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={group === g.id}
              onClick={() => setGroup(g.id)}
              className={chipClass(group === g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.id} className="flex flex-col gap-3.5">
          <div className="flex items-baseline gap-2.5">
            <h2 className="type-label text-ink-2">{g.label}</h2>
            <span className="text-ink-3 font-mono text-xs tabular-nums">
              {g.domains.length} domaine{g.domains.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="border-line bg-line grid gap-px border-y md:grid-cols-2 lg:grid-cols-3">
            {g.domains.map((d) => (
              <li key={d.slug} className="bg-background">
                <Link
                  href={`/domaines/${d.slug}`}
                  className="group focus-ring hover:bg-surface flex h-full flex-col gap-2 px-6 pt-5.5 pb-6 transition-[background-color] duration-(--duration-fast)"
                >
                  <span className="flex items-center justify-between gap-3">
                    <h3 className="type-h4 text-ink">{d.name}</h3>
                    <ArrowUpRight
                      aria-hidden
                      className="text-ink-3 size-4 opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  </span>
                  <span className="text-ink-3 text-sm leading-normal text-pretty">
                    {d.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {groups.length === 0 && (
        <p className="border-line text-ink-3 border-y py-14 text-center">
          Aucun domaine ne correspond à « {query.trim()} ».
        </p>
      )}
    </div>
  )
}
