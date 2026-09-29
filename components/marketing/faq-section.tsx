import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { Eyebrow, MARKETING_SECTION, MARKETING_WRAP } from "./marketing-hero"

export type FaqItem = { question: string; answer: string }

/** Questions en accordéon, la première ouverte au chargement. */
export const FaqAccordion = ({
  items,
  defaultOpen = true,
}: {
  items: readonly FaqItem[]
  defaultOpen?: boolean
}) => (
  <Accordion
    type="single"
    collapsible
    defaultValue={defaultOpen ? "item-0" : undefined}
    className="border-line border-t"
  >
    {items.map((item, i) => (
      <AccordionItem key={item.question} value={`item-${i}`}>
        <AccordionTrigger className="min-h-11 text-base">
          {item.question}
        </AccordionTrigger>
        <AccordionContent className="text-[15px] leading-relaxed">
          {item.answer}
        </AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
)

type FaqSectionProps = {
  label?: string
  title: string
  items: readonly FaqItem[]
}

/** Section FAQ en deux colonnes, avec le lien vers la page FAQ complète. */
export const FaqSection = ({
  label = "FAQ",
  title,
  items,
}: FaqSectionProps) => (
  <section className={MARKETING_SECTION}>
    <div
      className={cn(
        MARKETING_WRAP,
        "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14",
      )}
    >
      <div className="flex flex-col gap-3.5">
        <Eyebrow>{label}</Eyebrow>
        <h2 className="type-h2 text-ink">{title}</h2>
        <Link
          href="/faq"
          className="focus-ring text-accent-ink w-fit rounded-sm text-sm hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center"
        >
          Toutes les questions →
        </Link>
      </div>
      <FaqAccordion items={items} />
    </div>
  </section>
)
