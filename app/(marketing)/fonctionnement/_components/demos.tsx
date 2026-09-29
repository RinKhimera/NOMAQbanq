"use client"

import { ArrowRight, Check } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { chipClass } from "@/components/marketing/chip"
import { NavigatorPanel } from "@/components/quiz/navigator/question-navigator"
import { SessionHeader } from "@/components/quiz/session/session-header"
import { Button } from "@/components/ui/button"
import { EXAM_ZONES, zone } from "@/lib/attempt-clock"

const DOMAINS = [
  "Cardiologie",
  "Pneumologie",
  "Neurologie",
  "Pédiatrie",
  "Psychiatrie",
  "Gynécologie obstétrique",
  "Néphrologie",
  "Chirurgie",
]

const SIZES = [10, 20, 50]

/** Étape 1 : composer une série (démonstration, rien n'est enregistré). */
export const SeriesComposerDemo = () => {
  const [selected, setSelected] = useState(["Cardiologie", "Neurologie"])
  const [size, setSize] = useState(20)

  const toggle = (domain: string) =>
    setSelected((prev) =>
      prev.includes(domain)
        ? prev.filter((d) => d !== domain)
        : [...prev, domain],
    )

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-2.5">
        <span className="type-label" id="demo-domains">
          Domaines
        </span>
        <div
          role="group"
          aria-labelledby="demo-domains"
          className="flex flex-wrap gap-2"
        >
          {DOMAINS.map((domain) => {
            const on = selected.includes(domain)
            return (
              <button
                key={domain}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(domain)}
                className={chipClass(on)}
              >
                {on && <Check aria-hidden className="size-3.5" />}
                {domain}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="type-label" id="demo-size">
          Nombre de questions
        </span>
        <div
          role="group"
          aria-labelledby="demo-size"
          className="flex flex-wrap gap-1.5"
        >
          {SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={size === n}
              onClick={() => setSize(n)}
              className={chipClass(size === n)}
            >
              <span className="font-mono tabular-nums">{n}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="text-ink-2 font-mono text-[13px] whitespace-nowrap tabular-nums">
          {size} questions · {selected.length} domaine
          {selected.length > 1 ? "s" : ""}
        </span>
        {selected.length > 0 ? (
          <Button asChild size="sm" className="max-md:h-11">
            <Link href="/inscription">
              Commencer
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button size="sm" disabled className="max-md:h-11">
            Commencer
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}

const TOTAL = 40
const ANSWERED = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17])
const FLAGGED = new Set([6, 17])
const DEMO_REMAINING_MS = (1 * 3600 + 24 * 60 + 36) * 1000

/** Étape 3 : barre de passation et navigateur d'un examen blanc. */
export const ExamSessionDemo = () => {
  const [current, setCurrent] = useState(13)
  const cells = Array.from({ length: TOTAL }, (_, i) => ({
    state: ANSWERED.has(i + 1)
      ? ("answered" as const)
      : ("unanswered" as const),
    flagged: FLAGGED.has(i + 1),
  }))

  return (
    <div className="bg-surface border-line overflow-hidden rounded-lg border">
      <SessionHeader
        title="Examen blanc"
        titleAs="p"
        kind="exam"
        sticky={false}
        currentIndex={current}
        totalQuestions={TOTAL}
        answeredCount={ANSWERED.size}
        timer={{
          label: "01:24:36",
          zone: zone(DEMO_REMAINING_MS, EXAM_ZONES),
        }}
      />
      <div className="p-5">
        <NavigatorPanel
          cells={cells}
          currentIndex={current}
          onSelect={setCurrent}
          columns={8}
          kind="passation"
          title="Navigation"
        />
      </div>
    </div>
  )
}
