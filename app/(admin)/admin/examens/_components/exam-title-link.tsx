import Link from "next/link"
import type { ReactNode } from "react"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import { cn } from "@/lib/utils"
import { examHref } from "./exam-routes"

/** Titre d'examen menant à sa fiche : un lien par examen, donc sans prefetch. */
export const ExamTitleLink = ({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: ReactNode
}) => (
  <Link
    href={examHref(id)}
    prefetch={false}
    className={cn(
      "focus-ring text-ink rounded-xs underline-offset-[3px] hover:underline",
      className,
    )}
  >
    {children}
    <LinkPendingIndicator className="ml-1.5 inline-flex align-[-2px]" />
  </Link>
)
