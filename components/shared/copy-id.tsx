"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

/** Identifiant en mono, copié d'un clic. */
export const CopyId = ({ id }: { id: string }) => {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label="Copier l'identifiant"
      onClick={() => {
        void navigator.clipboard?.writeText(id)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      className="focus-ring text-ink-2 hover:bg-surface-2 -m-1 inline-flex cursor-pointer items-center gap-1.5 rounded-xs p-1 text-xs max-lg:min-h-11"
    >
      <span className="font-mono">{id}</span>
      {copied ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
    </button>
  )
}
