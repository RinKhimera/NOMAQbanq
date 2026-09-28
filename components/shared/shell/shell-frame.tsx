"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type ReactNode, useState } from "react"
import { LinkPendingIndicator } from "@/components/shared/link-pending-indicator"
import ThemeToggle from "@/components/shared/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { type ShellZone, pageTitle } from "@/lib/shell-navigation"
import { cn } from "@/lib/utils"
import { Logo } from "./logo"
import { SideNav } from "./side-nav"

const ZONE_FRAME = {
  student: {
    homeUrl: "/tableau-de-bord",
    tagline: "Préparation EACMC",
    navLabel: "Navigation de l'espace étudiant",
    side: "top-0 h-dvh w-66",
    top: "top-0",
    body: "max-w-280",
    sheet: "w-[min(300px,calc(100vw-40px))]",
  },
  admin: {
    homeUrl: "/admin",
    tagline: "Administration",
    navLabel: "Navigation de l'administration",
    // Sous l'AdminBar collante de 32 px.
    side: "top-8 h-[calc(100dvh-2rem)] w-62",
    top: "top-8",
    body: "max-w-310",
    sheet: "w-[min(288px,calc(100vw-40px))]",
  },
} satisfies Record<ShellZone, Record<string, string>>

type ShellFrameProps = {
  zone: ShellZone
  /** Bandeau collant au-dessus de tout (AdminBar). */
  banner?: ReactNode
  /** Bas de la navigation : liens de zone et utilisateur. */
  sideFooter: ReactNode
  children: ReactNode
}

/**
 * Cadre commun aux coquilles étudiante et admin : SideNav à partir de 1024 px,
 * Sheet en dessous. La bascule est en CSS (`lg:`), jamais sur une mesure de la
 * fenêtre : le HTML serveur est donc déjà le bon.
 */
export const ShellFrame = ({
  zone,
  banner,
  sideFooter,
  children,
}: ShellFrameProps) => {
  const pathname = usePathname()
  const frame = ZONE_FRAME[zone]
  const admin = zone === "admin"

  // Le Sheet est ouvert POUR une URL : une navigation le referme sans effet.
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null)
  const menuOpen = menuOpenAt === pathname
  const closeMenu = () => setMenuOpenAt(null)

  const logo = <Logo tagline={frame.tagline} admin={admin} />

  const sideContent = (onReselect?: () => void) => (
    <>
      <SideNav zone={zone} label={frame.navLabel} onReselect={onReselect} />
      <div className="mt-auto flex flex-col gap-2 p-3">{sideFooter}</div>
    </>
  )

  return (
    <div className="bg-background text-ink flex min-h-dvh flex-col">
      {banner}
      <div className="flex flex-1">
        <aside
          className={cn(
            "bg-surface border-line sticky hidden shrink-0 flex-col overflow-y-auto border-r lg:flex",
            frame.side,
          )}
        >
          <div className="border-line flex h-16 shrink-0 items-center border-b px-5">
            {/* Présent sur chaque page authentifiée : le prefetch par défaut
                rendrait le layout serveur (session + Neon) à chaque
                chargement, cf. `.claude/rules/loading-ui.md`. */}
            <Link
              href={frame.homeUrl}
              prefetch={false}
              className="focus-ring flex flex-1 items-center gap-2 rounded-md"
            >
              {logo}
              <LinkPendingIndicator className="ml-auto" />
            </Link>
          </div>
          {sideContent()}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "bg-background border-line sticky z-20 flex h-16 shrink-0 items-center gap-2 border-b px-4 sm:px-6",
              frame.top,
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 max-md:size-11 lg:hidden"
              aria-label="Ouvrir le menu"
              onClick={() => setMenuOpenAt(pathname)}
            >
              <Menu aria-hidden />
            </Button>
            <p className="text-ink mr-auto min-w-0 truncate text-base font-semibold">
              {pageTitle(pathname, zone)}
            </p>
            <ThemeToggle />
          </header>
          <main
            className={cn(
              "flex w-full flex-col gap-5 px-4 pt-6 pb-16 sm:px-6 md:pt-8",
              frame.body,
            )}
          >
            {children}
          </main>
        </div>
      </div>

      <Sheet
        open={menuOpen}
        onOpenChange={(open) => setMenuOpenAt(open ? pathname : null)}
      >
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className={cn("flex flex-col gap-0 p-0", frame.sheet)}
        >
          <SheetHeader className="border-line h-16 shrink-0 justify-center border-b px-5">
            <SheetTitle className="text-base">{logo}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col overflow-y-auto">
            {sideContent(closeMenu)}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

type SideLinkProps = {
  href: string
  icon: ReactNode
  children: ReactNode
}

/** Lien secondaire du bas de la SideNav (changement de zone). */
export const SideLink = ({ href, icon, children }: SideLinkProps) => (
  <Link
    href={href}
    prefetch={false}
    className="focus-ring text-ink-2 hover:bg-surface-2 hover:text-ink [&_svg]:text-ink-3 flex items-center gap-2.5 rounded-md p-2 text-[13px] transition-colors duration-(--duration-base) max-md:min-h-11 [&_svg]:size-3.75"
  >
    {icon}
    <span className="flex-1">{children}</span>
    <LinkPendingIndicator />
  </Link>
)
