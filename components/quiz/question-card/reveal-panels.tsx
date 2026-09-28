"use client"

import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import {
  CorrectionExplanation,
  type CorrectionImage,
  CorrectionReferences,
} from "@/components/shared/correction"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type PanelProps = {
  label: string
  count?: number
  defaultOpen: boolean
  children: ReactNode
}

const Panel = ({ label, count, defaultOpen, children }: PanelProps) => (
  <Collapsible defaultOpen={defaultOpen} className="border-line border-t">
    <CollapsibleTrigger className="focus-ring group hover:bg-surface-2 flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left transition-colors duration-(--duration-fast)">
      <span className="text-ink-3 font-mono text-xs font-medium tracking-[0.06em] uppercase">
        {label}
        {count !== undefined && <span> · {count}</span>}
      </span>
      <ChevronDown
        aria-hidden
        className="text-ink-3 size-4 group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent className="px-5 pb-5">{children}</CollapsibleContent>
  </Collapsible>
)

type RevealPanelsProps = {
  explanation: string
  references?: readonly string[]
  /** Correction seulement : jamais en passation (anti-triche). */
  images?: readonly CorrectionImage[]
}

/**
 * Correction d'une question en panneaux repliables : Explication ouverte,
 * Références fermées. Réservée à la correction (résultats, mode tuteur).
 */
export const RevealPanels = ({
  explanation,
  references = [],
  images,
}: RevealPanelsProps) => (
  <div className="bg-surface-2">
    <div data-testid="explanation-content">
      <Panel label="Explication" defaultOpen>
        <CorrectionExplanation
          explanation={explanation}
          references={references}
          images={images}
          className="text-ink-2 text-[15px] leading-[1.65]"
        />
      </Panel>
    </div>
    {references.length > 0 && (
      <Panel label="Références" count={references.length} defaultOpen={false}>
        <CorrectionReferences
          references={references}
          className="text-ink-2 text-[13px] leading-normal"
        />
      </Panel>
    )}
  </div>
)
