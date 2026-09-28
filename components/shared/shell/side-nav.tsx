"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useId } from "react"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import type { NavItem, NavSection } from "@/constants"
import {
  type ShellZone,
  activeNavUrl,
  navSections,
} from "@/lib/shell-navigation"
import { cn } from "@/lib/utils"

type SideNavProps = {
  zone: ShellZone
  label: string
  /** Clic sur le lien de la page courante : aucune navigation ne suivra. */
  onReselect?: () => void
}

export const SideNav = ({ zone, label, onReselect }: SideNavProps) => {
  const activeUrl = activeNavUrl(usePathname(), zone)

  return (
    <nav aria-label={label} className="flex flex-col gap-3.5 p-3">
      {navSections(zone).map((section) => (
        <NavGroup
          key={section.heading}
          section={section}
          activeUrl={activeUrl}
          admin={zone === "admin"}
          onReselect={onReselect}
        />
      ))}
    </nav>
  )
}

type NavGroupProps = {
  section: NavSection
  activeUrl: string | null
  admin: boolean
  onReselect?: () => void
}

const NavGroup = ({ section, activeUrl, admin, onReselect }: NavGroupProps) => {
  const headingId = useId()
  return (
    <div className="flex flex-col gap-0.5">
      <p
        id={headingId}
        className="text-ink-3 px-2.5 pt-1 pb-1.5 font-mono text-[10px] font-medium tracking-[0.06em] uppercase"
      >
        {section.heading}
      </p>
      <ul aria-labelledby={headingId} className="flex flex-col gap-0.5">
        {section.items.map((item) => (
          <li key={item.url}>
            <NavLink
              item={item}
              active={item.url === activeUrl}
              admin={admin}
              onReselect={onReselect}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

type NavLinkProps = {
  item: NavItem
  active: boolean
  admin: boolean
  onReselect?: () => void
}

// Routes dynamiques : un prefetch ne rapporte que le squelette (`loading.tsx`)
// mais coûte une invocation Vercel (layout + session Neon) par lien visible,
// rejouée à l'expiration du cache. Sans prefetch, le squelette n'arrive
// qu'avec la réponse : `LinkPendingIndicator` donne le retour visuel d'ici là.
const NavLink = ({ item, active, admin, onReselect }: NavLinkProps) => (
  <Link
    href={item.url}
    prefetch={false}
    aria-current={active ? "page" : undefined}
    onClick={active ? onReselect : undefined}
    className={cn(
      "focus-ring relative flex h-8.5 items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-sm transition-colors duration-(--duration-base) max-md:h-11",
      active
        ? [
            "bg-surface-2 text-ink font-medium",
            "before:absolute before:inset-y-0 before:left-0 before:w-0.5",
            admin ? "before:bg-admin" : "before:bg-accent",
          ]
        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
    )}
  >
    <item.icon
      aria-hidden
      className={cn(
        "size-4 shrink-0",
        active ? (admin ? "text-admin" : "text-accent") : "text-ink-3",
      )}
    />
    <span className="flex-1 truncate">{item.title}</span>
    <LinkPendingIndicator />
  </Link>
)
