"use client"

import { SignOutButton } from "@clerk/clerk-react"
import { LayoutDashboard, LogOut, Monitor, Moon, Sun, User } from "lucide-react"
import { useTheme } from "next-themes"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface NavigationItem {
  name: string
  href: string
}

interface CurrentUser {
  name?: string | null
  email?: string | null
  image?: string | null
}

interface MobileMenuProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  navigation: NavigationItem[]
  currentUser: CurrentUser | null | undefined
  isAuthenticated: boolean
}

export const MobileMenu = ({
  isOpen,
  onOpenChange,
  navigation,
  currentUser,
  isAuthenticated,
}: MobileMenuProps) => {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const handleLinkClick = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-75 border-l border-gray-200 bg-white p-0 dark:border-gray-800 dark:bg-gray-950 sm:w-85"
      >
        <SheetHeader className="border-b border-gray-200 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-gray-900/50">
          <SheetTitle className="text-left">
            <div className="flex items-center gap-2.5">
              <div className="relative size-8">
                <Image
                  src="/noma-logo.svg"
                  alt="NOMAQbanq Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex items-baseline">
                <span className="bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-lg font-extrabold text-transparent">
                  NOMAQ
                </span>
                <span className="bg-linear-to-r from-indigo-600 to-blue-600 bg-clip-text text-lg font-extrabold text-transparent">
                  banq
                </span>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="flex h-[calc(100vh-5rem)] flex-col">
          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={handleLinkClick}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{item.name}</span>
                  {isActive && (
                    <div className="flex size-2 items-center justify-center">
                      <span className="absolute size-2 animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative size-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Theme Selector */}
          <div className="border-t border-gray-200 p-4 dark:border-gray-800">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Apparence
            </p>
            <div className="flex gap-2">
              {[
                { value: "light", label: "Clair", icon: Sun },
                { value: "dark", label: "Sombre", icon: Moon },
                { value: "system", label: "Auto", icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-all duration-200 ${
                    theme === value
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* User Section */}
          <div className="border-t border-gray-200 p-4 dark:border-gray-800">
            {isAuthenticated && currentUser ? (
              <div className="space-y-3">
                {/* User Info Card */}
                <div className="rounded-xl bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="size-11 border-2 border-white shadow-md dark:border-gray-900">
                        <AvatarImage
                          src={currentUser.image ?? undefined}
                          alt={currentUser.name ?? "Utilisateur"}
                        />
                        <AvatarFallback className="bg-linear-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white">
                          {currentUser.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {currentUser.name}
                      </p>
                      <p className="truncate text-xs text-gray-600 dark:text-gray-400">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-1.5">
                  <Link href="/dashboard" onClick={handleLinkClick}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-xl font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <LayoutDashboard className="mr-3 size-4" />
                      Dashboard
                      <Badge className="ml-auto bg-blue-600 text-xs font-semibold">
                        Nouveau
                      </Badge>
                    </Button>
                  </Link>

                  <Button
                    variant="ghost"
                    className="w-full justify-start rounded-xl font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <User className="mr-3 size-4" />
                    Profil
                  </Button>

                  <SignOutButton>
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-xl font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      <LogOut className="mr-3 size-4" />
                      Déconnexion
                    </Button>
                  </SignOutButton>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <Link
                  href="/auth/sign-in"
                  onClick={handleLinkClick}
                  className="block"
                >
                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-2 font-semibold"
                  >
                    Connexion
                  </Button>
                </Link>
                <Link
                  href="/auth/sign-up"
                  onClick={handleLinkClick}
                  className="block"
                >
                  <Button className="w-full rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md">
                    Inscription
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
