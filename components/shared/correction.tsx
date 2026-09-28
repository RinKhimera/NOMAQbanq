"use client"

import Image from "next/image"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * Rendu de la correction d'une question (explication, références, images
 * d'explication), partagé par le quiz et l'admin. Affiche ce qui est stocké et
 * n'interprète que deux conventions : une ligne vide sépare deux paragraphes,
 * et `[n]`, `[n-m]`, `[n,m]` sont des appels de citation vers la référence de
 * même position (base 1). Seule entorse : une référence qui porte déjà son
 * numéro n'en reçoit pas un second (voir `carriesOwnNumber`). L'habillage
 * reste à la surface appelante.
 */

export type CorrectionImage = { key: string; url: string }

type Segment =
  | { kind: "text"; text: string }
  | { kind: "citation"; text: string; numbers: number[] }
  | { kind: "unresolved"; text: string }

const CITATION = /\[(\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*)\]/g

/** Numéros visés par le contenu d'un appel, ou `null` s'il sort de la liste. */
function resolveCitation(body: string, count: number): number[] | null {
  const numbers = new Set<number>()
  for (const part of body.split(",")) {
    const [from, to = from] = part.split(/[-–]/).map((n) => Number(n.trim()))
    if (from < 1 || to < from || to > count) return null
    for (let n = from; n <= to; n++) numbers.add(n)
  }
  return [...numbers].sort((a, b) => a - b)
}

function parseParagraph(paragraph: string, count: number): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const match of paragraph.matchAll(CITATION)) {
    const numbers = resolveCitation(match[1], count)
    if (match.index > last) {
      segments.push({ kind: "text", text: paragraph.slice(last, match.index) })
    }
    segments.push(
      numbers
        ? { kind: "citation", text: match[0], numbers }
        : { kind: "unresolved", text: match[0] },
    )
    last = match.index + match[0].length
  }
  if (last < paragraph.length) {
    segments.push({ kind: "text", text: paragraph.slice(last) })
  }
  return segments
}

function Citation({
  text,
  numbers,
  references,
}: {
  text: string
  numbers: number[]
  references: readonly string[]
}) {
  const label =
    numbers.length === 1
      ? `Voir la référence ${numbers[0]}`
      : `Voir les références ${numbers.join(", ")}`

  return (
    <Popover>
      <PopoverTrigger
        data-testid="citation"
        aria-label={label}
        className="focus-ring cursor-pointer rounded-sm font-semibold underline decoration-dotted underline-offset-2 hover:decoration-solid"
      >
        {text}
      </PopoverTrigger>
      <PopoverContent
        data-testid="citation-popover"
        aria-label={label}
        className="max-h-72 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-3"
      >
        <ol className="space-y-2 text-sm">
          {numbers.map((n) => (
            <ReferenceItem key={n} reference={references[n - 1]} position={n} />
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  )
}

export function CorrectionExplanation({
  explanation,
  references,
  images,
  className,
}: {
  explanation: string
  references: readonly string[] | null | undefined
  images?: readonly CorrectionImage[]
  className?: string
}) {
  const refs = references ?? []
  const paragraphs = explanation.split(/\n\s*\n/).filter((p) => p.trim() !== "")

  return (
    <div className={cn("space-y-3", className)}>
      {paragraphs.map((paragraph, i) => (
        <p
          key={i}
          className="leading-relaxed wrap-break-word whitespace-pre-line"
        >
          {parseParagraph(paragraph, refs.length).map((segment, j) => {
            if (segment.kind === "text") return segment.text
            if (segment.kind === "unresolved") {
              return (
                <span key={j} className="whitespace-nowrap">
                  {segment.text}
                </span>
              )
            }
            return (
              <Citation
                key={j}
                text={segment.text}
                numbers={segment.numbers}
                references={refs}
              />
            )
          })}
        </p>
      ))}

      {images && images.length > 0 && (
        <div
          data-testid="explanation-images"
          className="mt-4 flex flex-wrap gap-2"
        >
          {images.map((img) => (
            <Image
              key={img.key}
              src={img.url}
              alt="Image d'explication"
              width={800}
              height={600}
              sizes="(max-width: 768px) 100vw, 700px"
              className="h-auto max-h-48 w-auto max-w-full rounded-lg border border-current/20"
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Une entrée qui commence déjà par son propre numéro (bloc collé « 1.⏎… »)
 * n'en reçoit pas un second. Un numéro de tête différent de la position (titre
 * de chapitre « 9. … ») n'est pas un numéro de liste.
 */
const carriesOwnNumber = (reference: string, position: number) =>
  new RegExp(String.raw`^\s*(?:${position}\.|\[${position}\])(?:\s|$)`).test(
    reference,
  )

function ReferenceItem({
  reference,
  position,
}: {
  reference: string
  position: number
}) {
  return (
    <li className="flex gap-2 leading-relaxed">
      {!carriesOwnNumber(reference, position) && (
        <span className="shrink-0 font-semibold">{position}.</span>
      )}
      <span className="min-w-0 wrap-break-word whitespace-pre-line">
        {reference}
      </span>
    </li>
  )
}

export function CorrectionReferences({
  references,
  className,
}: {
  references: readonly string[] | null | undefined
  className?: string
}) {
  if (!references || references.length === 0) return null

  return (
    <ol className={cn("space-y-2", className)}>
      {references.map((reference, index) => (
        <ReferenceItem key={index} reference={reference} position={index + 1} />
      ))}
    </ol>
  )
}
