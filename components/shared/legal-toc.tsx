"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import {
  IconFileText,
  IconShield,
  IconCookie,
  IconChevronRight,
} from "@tabler/icons-react"

type PageType = "conditions" | "confidentialite" | "cookies"

interface SectionInfo {
  id: string
  title: string
}

interface LegalTOCProps {
  sections: SectionInfo[]
  currentPage: PageType
}

const pageConfig: Record<
  PageType,
  { label: string; href: string; icon: typeof IconFileText; color: string }
> = {
  conditions: {
    label: "Conditions d'utilisation",
    href: "/conditions",
    icon: IconFileText,
    color: "text-blue-600 dark:text-blue-400",
  },
  confidentialite: {
    label: "Politique de confidentialité",
    href: "/confidentialite",
    icon: IconShield,
    color: "text-violet-600 dark:text-violet-400",
  },
  cookies: {
    label: "Politique de cookies",
    href: "/cookies",
    icon: IconCookie,
    color: "text-amber-600 dark:text-amber-400",
  },
}

const accentColors: Record<PageType, string> = {
  conditions: "bg-blue-500",
  confidentialite: "bg-violet-500",
  cookies: "bg-amber-500",
}

export const LegalTOC = ({ sections, currentPage }: LegalTOCProps) => {
  const [activeSection, setActiveSection] = useState<string>("")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      {
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      }
    )

    sections.forEach((section) => {
      const element = document.getElementById(section.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [sections])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const offset = 100
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
    }
  }

  const otherPages = (Object.keys(pageConfig) as PageType[]).filter(
    (page) => page !== currentPage
  )

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="hidden lg:block"
    >
      <div className="sticky top-22.5 z-45 space-y-6">
        {/* Table des matières */}
        <nav className="rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800/60 dark:bg-gray-900/80">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Table des matières
          </h3>
          <ul className="space-y-1">
            {sections.map((section, index) => {
              const isActive = activeSection === section.id
              return (
                <li key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white"
                    }`}
                  >
                    {/* Indicator dot */}
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? `${accentColors[currentPage]} text-white`
                          : "bg-gray-200 text-gray-500 group-hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:group-hover:bg-gray-600"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="line-clamp-2 leading-tight">
                      {section.title}
                    </span>
                    {/* Active indicator bar */}
                    {isActive && (
                      <motion.div
                        layoutId="activeSection"
                        className={`absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full ${accentColors[currentPage]}`}
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Liens vers autres pages */}
        <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800/60 dark:bg-gray-900/80">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Autres documents
          </h3>
          <ul className="space-y-2">
            {otherPages.map((page) => {
              const config = pageConfig[page]
              const Icon = config.icon
              return (
                <li key={page}>
                  <Link
                    href={config.href}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 transition-all hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50"
                  >
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className="flex-1 group-hover:text-gray-900 dark:group-hover:text-white">
                      {config.label}
                    </span>
                    <IconChevronRight className="h-4 w-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </motion.aside>
  )
}
