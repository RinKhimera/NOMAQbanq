"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserAvatar } from "@/components/shared/user-avatar"
import { SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { HEADER_NAV, MENU_ONLY_NAV } from "./nav"

const THEMES = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const

interface CurrentUser {
  name?: string | null
  email?: string | null
  image?: string | null
}

/** Contenu du Sheet : la racine `Sheet` vit dans l'en-tête, avec son déclencheur. */
interface MobileMenuProps {
  onClose: () => void
  currentUser: CurrentUser | null | undefined
  isAuthenticated: boolean
  onSignOut: () => Promise<void>
}

const rowClass =
  "focus-ring border-line text-ink-2 hover:bg-surface-2 hover:text-ink flex min-h-11 items-center rounded-md border-b px-3 text-[15px] transition-colors duration-(--duration-base)"

export const MobileMenu = ({
  onClose: close,
  currentUser,
  isAuthenticated,
  onSignOut,
}: MobileMenuProps) => {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  return (
    <SheetContent
      side="right"
      aria-describedby={undefined}
      className="flex w-[min(320px,calc(100vw-32px))] flex-col gap-0 p-0"
    >
      <SheetHeader className="border-line h-16 shrink-0 justify-center border-b px-5 text-left">
        <SheetTitle className="text-base">Menu</SheetTitle>
      </SheetHeader>

      <nav
        aria-label="Menu du site"
        className="flex flex-1 flex-col overflow-y-auto px-3 py-2"
      >
        {[...HEADER_NAV, ...MENU_ONLY_NAV].map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              aria-current={isActive ? "page" : undefined}
              className={cn(rowClass, isActive && "text-ink font-medium")}
            >
              {item.name}
            </Link>
          )
        })}
        {isAuthenticated && currentUser ? (
          <>
            <Link href="/tableau-de-bord" onClick={close} className={rowClass}>
              Tableau de bord
            </Link>
            <div className="flex items-center gap-3 px-3 pt-4">
              <UserAvatar
                name={currentUser.name}
                image={currentUser.image}
                className="size-8"
                fallbackClassName="bg-surface-2 text-ink-2 text-xs font-medium"
              />
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate text-sm font-medium">
                  {currentUser.name}
                </p>
                <p className="text-ink-3 truncate text-xs">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                close()
                await onSignOut()
              }}
              className="focus-ring text-danger-ink hover:bg-danger-soft mt-2 flex min-h-11 items-center rounded-md px-3 text-left text-[15px] transition-colors duration-(--duration-base)"
            >
              Se déconnecter
            </button>
          </>
        ) : (
          <Link
            href="/connexion"
            onClick={close}
            className={cn(rowClass, "text-accent-ink border-b-0")}
          >
            Connexion
          </Link>
        )}
      </nav>

      <div className="border-line shrink-0 border-t p-4">
        <p className="text-ink-3 mb-2 font-mono text-xs tracking-[0.06em] uppercase">
          Apparence
        </p>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "focus-ring flex min-h-11 flex-col items-center justify-center gap-1 rounded-md border text-xs transition-colors duration-(--duration-base)",
                theme === value
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </SheetContent>
  )
}
