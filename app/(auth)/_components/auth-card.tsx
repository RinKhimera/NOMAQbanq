"use client"

import type { LucideIcon } from "lucide-react"
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react"
import { TONE_TEXT, type Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

type AuthCardProps = Omit<ComponentProps<"div">, "title"> & {
  title: ReactNode
  description?: ReactNode
  /** Icône d'état (courriel envoyé, lien expiré), au-dessus du titre. */
  icon?: LucideIcon
  iconTone?: Tone
  /**
   * Carte qui remplace un formulaire (courriel envoyé) : le bouton activé a
   * disparu, le focus va au titre plutôt que de tomber sur `<body>`.
   */
  focusTitle?: boolean
}

/** Carte des écrans d'authentification : le `h1` de la page, puis le contenu. */
export const AuthCard = ({
  title,
  description,
  icon: Icon,
  iconTone = "success",
  focusTitle = false,
  className,
  children,
  ...props
}: AuthCardProps) => {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus()
  }, [focusTitle])

  return (
    <div
      className={cn(
        "bg-surface border-line shadow-1 flex w-full max-w-110 flex-col gap-5 rounded-lg border p-8 max-[480px]:px-5 max-[480px]:py-6",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-2">
        {Icon && (
          <Icon
            aria-hidden
            className={cn("mb-2 size-6", TONE_TEXT[iconTone])}
          />
        )}
        <h1
          ref={titleRef}
          tabIndex={focusTitle ? -1 : undefined}
          className="type-h2 text-ink outline-none"
        >
          {title}
        </h1>
        {description && <p className="text-ink-3 text-[15px]">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export const AuthDivider = () => (
  <div className="flex items-center gap-3">
    <span className="bg-line h-px flex-1" />
    <span className="type-label shrink-0">ou</span>
    <span className="bg-line h-px flex-1" />
  </div>
)
