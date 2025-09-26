"use client"

import { SignOutButton } from "@clerk/clerk-react"
import { LogOut, Menu, Monitor, Moon, Sun, User, X } from "lucide-react"
import { useTheme } from "next-themes"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import ThemeToggle from "./shared/theme-toggle"

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false)
  const { setTheme } = useTheme()
  const { currentUser, isAuthenticated } = useCurrentUser()

  const navigation = [
    { name: "Accueil", href: "/" },
    { name: "Domaines", href: "/domaines" },
    { name: "À propos", href: "/a-propos" },
  ]

  return (
    <nav className="glass-card fixed top-0 z-50 w-full border-b border-white/20 bg-white/80 shadow-lg dark:border-gray-800/50 dark:bg-gray-900/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center space-x-2">
            <div className="relative size-20">
              <Image
                src="/noma-logo.svg"
                alt="Logo NOMAQbanq"
                fill
                sizes="60px"
                priority
                className="object-contain p-1"
              />
            </div>
            <span className="font-display text-2xl font-bold text-gray-900 dark:text-white">
              NOMAQbanq
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center space-x-6 md:flex">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="group relative text-lg font-medium text-gray-700 transition-all duration-300 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
              >
                {item.name}
                <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}

            <div className="flex items-center space-x-3">
              {/* Theme Toggle */}
              <ThemeToggle />

              {isAuthenticated && currentUser ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={currentUser.image}
                          alt={currentUser.name}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                          {currentUser.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="glass-card w-56 border border-gray-200 dark:border-gray-700"
                  >
                    <DropdownMenuItem className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <SignOutButton>
                      <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Déconnexion</span>
                      </DropdownMenuItem>
                    </SignOutButton>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Link href="/auth/sign-in">
                    <Button
                      variant="ghost"
                      className="rounded-xl px-6 py-2 font-medium text-gray-700 transition-all duration-300 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    >
                      Connexion
                    </Button>
                  </Link>
                  <Link href="/auth/sign-up">
                    <Button className="btn-modern transform rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-2 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl">
                      Inscription
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center space-x-2 md:hidden">
            {/* Mobile Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                >
                  <Sun className="h-5 w-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                  <Moon className="absolute h-5 w-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="glass-card border border-gray-200 dark:border-gray-700"
              >
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className="cursor-pointer"
                >
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Clair</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className="cursor-pointer"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Sombre</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className="cursor-pointer"
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  <span>Système</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-xl p-3 text-gray-700 transition-all duration-300 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden">
            <div className="glass-card mt-4 space-y-2 rounded-2xl border-t border-white/20 bg-white/90 px-2 pt-2 pb-6 shadow-xl dark:border-gray-800/50 dark:bg-gray-900/90">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block rounded-xl px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                {isAuthenticated && currentUser ? (
                  <div className="flex items-center space-x-3 px-4 py-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={currentUser.image}
                        alt={currentUser.name}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                        {currentUser.name?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {currentUser.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Link href="/auth/sign-in">
                      <Button
                        variant="ghost"
                        className="w-full justify-start rounded-xl font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                      >
                        Connexion
                      </Button>
                    </Link>
                    <Link href="/auth/sign-up">
                      <Button className="btn-modern w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg hover:from-blue-700 hover:to-indigo-700">
                        Inscription
                      </Button>
                    </Link>
                  </>
                )}
                {isAuthenticated && currentUser && (
                  <>
                    <DropdownMenuSeparator />
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-xl font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Profil
                    </Button>
                    <SignOutButton>
                      <Button
                        variant="ghost"
                        className="w-full justify-start rounded-xl font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Déconnexion
                      </Button>
                    </SignOutButton>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
