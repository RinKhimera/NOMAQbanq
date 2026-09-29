"use client"

import { Mail } from "lucide-react"
import { useState } from "react"
import { chipClass } from "@/components/marketing/chip"
import { FaqAccordion } from "@/components/marketing/faq-section"
import {
  MARKETING_SECTION,
  MARKETING_WRAP,
  MarketingHero,
} from "@/components/marketing/marketing-hero"
import { SearchInput } from "@/components/shared/search-input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { faqCategories } from "../_data/faq-data"

const ALL = "all"

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const TOTAL = faqCategories.reduce((n, c) => n + c.questions.length, 0)

export default function FaqPageClient() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(ALL)

  const needle = normalize(query.trim())
  const shown = faqCategories
    .filter((c) => category === ALL || c.id === category)
    .map((c) => ({
      ...c,
      questions: c.questions.filter(
        (item) => !needle || normalize(`${item.q} ${item.a}`).includes(needle),
      ),
    }))
    .filter((c) => c.questions.length > 0)
  const resultCount = shown.reduce((n, c) => n + c.questions.length, 0)

  const categoryButton = (id: string, label: string, count: number) => (
    <button
      key={id}
      type="button"
      aria-pressed={category === id}
      onClick={() => setCategory(id)}
      className={cn(
        "focus-ring flex min-h-9 cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-[background-color] duration-(--duration-fast)",
        category === id
          ? "bg-surface-2 text-ink font-medium"
          : "text-ink-2 hover:bg-surface-2",
      )}
    >
      <span>{label}</span>
      <span className="text-ink-3 font-mono text-xs tabular-nums">{count}</span>
    </button>
  )

  return (
    <>
      <MarketingHero
        label="FAQ"
        title="Questions fréquentes"
        description="Tout ce qu'il faut savoir sur la plateforme, les accès et le contenu."
      >
        <div className="w-full max-w-120 pt-1">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="Rechercher une question"
            className="max-md:h-11"
          />
        </div>
      </MarketingHero>

      <section className={MARKETING_SECTION}>
        <div
          className={cn(
            MARKETING_WRAP,
            "grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16",
          )}
        >
          <nav
            aria-label="Catégories"
            className="sticky top-22 hidden flex-col gap-0.5 lg:flex"
          >
            <span className="type-label px-2.5 pb-2">Catégories</span>
            {categoryButton(ALL, "Toutes", TOTAL)}
            {faqCategories.map((c) =>
              categoryButton(c.id, c.title, c.questions.length),
            )}
          </nav>

          {/* Sous 1024 px, le sommaire latéral devient une rangée de pastilles. */}
          <div
            role="group"
            aria-label="Catégories"
            className="flex flex-wrap gap-1.5 lg:hidden"
          >
            {[{ id: ALL, title: "Toutes" }, ...faqCategories].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                className={chipClass(category === c.id)}
              >
                {c.title}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-col gap-12">
            {needle && (
              <p
                aria-live="polite"
                className="text-ink-3 font-mono text-[13px] tabular-nums"
              >
                {resultCount} résultat{resultCount > 1 ? "s" : ""} pour «{" "}
                {query.trim()} »
              </p>
            )}
            {shown.map((c) => (
              <div key={c.id} className="flex flex-col gap-4">
                <h2 className="type-h3 text-ink">{c.title}</h2>
                {/* Une recherche rouvre la première réponse de chaque catégorie. */}
                <FaqAccordion
                  key={needle}
                  items={c.questions.map((item) => ({
                    question: item.q,
                    answer: item.a,
                  }))}
                  defaultOpen={!!needle}
                />
              </div>
            ))}
            {resultCount === 0 && (
              <p className="border-line text-ink-3 border-t py-12">
                Aucune question ne correspond. Écrivez-nous à{" "}
                <a
                  href="mailto:nomaqbanq@outlook.com"
                  className="focus-ring text-accent-ink rounded-sm hover:underline"
                >
                  nomaqbanq@outlook.com
                </a>
                .
              </p>
            )}
            <div className="bg-surface border-line flex flex-wrap items-center justify-between gap-4 rounded-lg border p-6">
              <div>
                <p className="text-ink text-base font-semibold">
                  Vous n&apos;avez pas trouvé votre réponse ?
                </p>
                <p className="text-ink-3 text-sm">
                  Réponse sous 24 h en général.
                </p>
              </div>
              <Button asChild variant="outline" className="max-md:h-11">
                <a href="mailto:nomaqbanq@outlook.com">
                  <Mail aria-hidden />
                  Nous écrire
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
