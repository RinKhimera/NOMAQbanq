"use client"

import { ChevronDown, Info } from "lucide-react"
import Link from "next/link"
import { type ReactNode, isValidElement, useEffect, useState } from "react"
import { chipClass } from "@/components/marketing/chip"
import {
  MARKETING_SECTION,
  MARKETING_WRAP,
  MarketingHero,
} from "@/components/marketing/marketing-hero"
import { cn } from "@/lib/utils"

type ListBlock = { list: (ReactNode | [string, ReactNode])[] }
type NoteBlock = { note: ReactNode }
type ContactBlock = { contact: true }
type SmallBlock = { small: ReactNode }
type ShapedBlock = ListBlock | NoteBlock | ContactBlock | SmallBlock

/**
 * Un bloc d'article : un paragraphe, une liste (entrée simple ou « terme :
 * définition »), une note encadrée, les coordonnées de contact, ou une
 * mention en petits caractères.
 */
export type LegalBlock = ReactNode | ShapedBlock

export type LegalArticle = { id: string; title: string; blocks: LegalBlock[] }

const DOCUMENTS = [
  { num: "01", label: "Conditions", href: "/conditions" },
  { num: "02", label: "Confidentialité", href: "/confidentialite" },
  { num: "03", label: "Cookies", href: "/cookies" },
] as const

const CONTACT = [
  ["Courriel", "nomaqbanq@outlook.com"],
  ["Téléphone", "+1 (438) 875-0746"],
  ["Adresse", "114 rue Isabelle, Gatineau (Québec) J8Y 5H3, Canada"],
] as const

const TEXT = "text-ink-2 text-base leading-[1.7] text-pretty"

const isShaped = (block: LegalBlock): block is ShapedBlock =>
  typeof block === "object" &&
  block !== null &&
  !isValidElement(block) &&
  !(Symbol.iterator in block) &&
  !("then" in block)

const Block = ({ block }: { block: LegalBlock }) => {
  if (!isShaped(block)) return <p className={TEXT}>{block}</p>
  if ("list" in block) {
    return (
      <ul className={cn(TEXT, "flex list-disc flex-col gap-1.5 pl-5")}>
        {block.list.map((item, i) => (
          <li key={i}>
            {Array.isArray(item) ? (
              <>
                <strong className="text-ink font-semibold">
                  {item[0]}&nbsp;:
                </strong>{" "}
                {item[1]}
              </>
            ) : (
              item
            )}
          </li>
        ))}
      </ul>
    )
  }
  if ("note" in block) {
    return (
      <div
        className={cn(
          TEXT,
          "bg-surface-2 border-line flex items-start gap-2.5 rounded-md border px-4 py-3.5 text-[15px]",
        )}
      >
        <Info aria-hidden className="text-ink-3 mt-1 size-4 shrink-0" />
        <span>{block.note}</span>
      </div>
    )
  }
  if ("contact" in block) {
    return (
      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-2 text-[15px] max-sm:grid-cols-1">
        {CONTACT.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-ink-3">{term}</dt>
            <dd className="text-ink max-sm:mb-2">{value}</dd>
          </div>
        ))}
      </dl>
    )
  }
  return <p className="text-ink-3 text-sm leading-[1.7]">{block.small}</p>
}

type LegalDocumentProps = {
  num: (typeof DOCUMENTS)[number]["num"]
  title: string
  lead: string
  updated: string
  articles: LegalArticle[]
}

/** Gabarit des documents légaux : sommaire latéral, articles numérotés. */
export const LegalDocument = ({
  num,
  title,
  lead,
  updated,
  articles,
}: LegalDocumentProps) => {
  const [active, setActive] = useState(articles[0]?.id)

  useEffect(() => {
    const onScroll = () => {
      let current = articles[0]?.id
      for (const { id } of articles) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < 140) current = id
      }
      setActive(current)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [articles])

  return (
    <>
      <MarketingHero
        label={`Document légal · ${num}`}
        title={title}
        description={lead}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-ink-3 mr-2.5 font-mono text-[13px]">
            Dernière mise à jour : {updated}
          </span>
          <nav aria-label="Documents légaux" className="flex flex-wrap gap-1.5">
            {DOCUMENTS.map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                aria-current={doc.num === num ? "page" : undefined}
                className={chipClass(doc.num === num)}
              >
                {doc.label}
              </Link>
            ))}
          </nav>
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
            aria-label="Sommaire"
            className="sticky top-22 hidden flex-col gap-0.5 lg:flex"
          >
            <span className="type-label px-2.5 pb-2">Sommaire</span>
            {articles.map((article, i) => (
              <a
                key={article.id}
                href={`#${article.id}`}
                aria-current={active === article.id ? "location" : undefined}
                className={cn(
                  "focus-ring flex min-h-9 items-start gap-2 rounded-md px-2.5 py-1.5 text-sm transition-[background-color] duration-(--duration-fast)",
                  active === article.id
                    ? "bg-surface-2 text-ink font-medium"
                    : "text-ink-2 hover:bg-surface-2",
                )}
              >
                <span
                  aria-hidden
                  className="text-ink-3 w-5 shrink-0 pt-px font-mono text-xs tabular-nums"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{article.title}</span>
              </a>
            ))}
          </nav>

          {/* Sous 1024 px, le sommaire latéral devient un bloc repliable. */}
          <details className="group border-line bg-surface rounded-lg border lg:hidden">
            <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 [&::-webkit-details-marker]:hidden">
              <span className="type-label">Sommaire</span>
              <ChevronDown
                aria-hidden
                className="text-ink-3 size-4 group-open:rotate-180"
              />
            </summary>
            <nav aria-label="Sommaire du document" className="px-2 pb-2">
              <ol className="flex flex-col">
                {articles.map((article, i) => (
                  <li key={article.id}>
                    <a
                      href={`#${article.id}`}
                      className="focus-ring hover:bg-surface-2 text-ink-2 flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm transition-[background-color] duration-(--duration-fast)"
                    >
                      <span
                        aria-hidden
                        className="text-ink-3 w-5 shrink-0 font-mono text-xs tabular-nums"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {article.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </details>

          <article className="flex max-w-180 min-w-0 flex-col">
            {articles.map((article, i) => (
              <section
                key={article.id}
                id={article.id}
                aria-labelledby={`${article.id}-title`}
                className={cn(
                  "flex scroll-mt-22 flex-col gap-3.5",
                  i === 0 ? "pb-9" : "py-9",
                  i < articles.length - 1 && "border-line border-b",
                )}
              >
                <span className="text-accent-ink font-mono text-xs tabular-nums">
                  Article {String(i + 1).padStart(2, "0")}
                </span>
                <h2 id={`${article.id}-title`} className="type-h3 text-ink">
                  {article.title}
                </h2>
                {article.blocks.map((block, j) => (
                  <Block key={j} block={block} />
                ))}
              </section>
            ))}
          </article>
        </div>
      </section>
    </>
  )
}
