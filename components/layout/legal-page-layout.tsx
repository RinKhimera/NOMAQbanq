"use client"

import { ReactNode } from "react"
import { motion } from "motion/react"
import {
  IconFileText,
  IconShield,
  IconCookie,
  IconCalendar,
} from "@tabler/icons-react"
import { LegalProgressBar } from "@/components/shared/legal-progress-bar"
import { LegalTOC } from "@/components/shared/legal-toc"
import { LegalNavCards } from "@/components/shared/legal-nav-cards"

type PageType = "conditions" | "confidentialite" | "cookies"

interface SectionInfo {
  id: string
  title: string
}

interface LegalPageLayoutProps {
  pageType: PageType
  title: string
  subtitle: string
  lastUpdated: string
  articleNumber: string
  sections: SectionInfo[]
  children: ReactNode
}

const pageConfig: Record<
  PageType,
  {
    badge: string
    icon: typeof IconFileText
    accentColor: string
    numberColor: string
    badgeBg: string
    badgeText: string
  }
> = {
  conditions: {
    badge: "Document juridique",
    icon: IconFileText,
    accentColor: "text-blue-600 dark:text-blue-400",
    numberColor: "text-blue-100 dark:text-blue-950",
    badgeBg: "bg-blue-100 dark:bg-blue-900/40",
    badgeText: "text-blue-700 dark:text-blue-300",
  },
  confidentialite: {
    badge: "Protection des données",
    icon: IconShield,
    accentColor: "text-violet-600 dark:text-violet-400",
    numberColor: "text-violet-100 dark:text-violet-950",
    badgeBg: "bg-violet-100 dark:bg-violet-900/40",
    badgeText: "text-violet-700 dark:text-violet-300",
  },
  cookies: {
    badge: "Traceurs et cookies",
    icon: IconCookie,
    accentColor: "text-amber-600 dark:text-amber-400",
    numberColor: "text-amber-100 dark:text-amber-950",
    badgeBg: "bg-amber-100 dark:bg-amber-900/40",
    badgeText: "text-amber-700 dark:text-amber-300",
  },
}

export default function LegalPageLayout({
  pageType,
  title,
  subtitle,
  lastUpdated,
  articleNumber,
  sections,
  children,
}: LegalPageLayoutProps) {
  const config = pageConfig[pageType]
  const Icon = config.icon

  return (
    <>
      <LegalProgressBar pageType={pageType} />

      <div className="min-h-screen bg-[#FAFBFC] dark:bg-gray-950">
        {/* Header Section */}
        <header className="relative overflow-hidden border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="relative">
              {/* Large decorative number */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`pointer-events-none absolute -left-4 -top-8 select-none font-serif text-[10rem] font-black leading-none sm:text-[14rem] lg:text-[18rem] ${config.numberColor}`}
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {articleNumber}
              </motion.div>

              {/* Content */}
              <div className="relative z-10">
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${config.badgeBg} ${config.badgeText}`}
                  >
                    <Icon className="h-4 w-4" />
                    {config.badge}
                  </span>
                </motion.div>

                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="font-display mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white"
                >
                  {title}
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400"
                >
                  {subtitle}
                </motion.p>

                {/* Last updated */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="mt-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500"
                >
                  <IconCalendar className="h-4 w-4" />
                  <span>Dernière mise à jour : {lastUpdated}</span>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Decorative gradient line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-700" />
        </header>

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_280px]">
            {/* Content Column */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* Mobile TOC */}
              <div className="mb-8 lg:hidden">
                <details className="group rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm dark:border-gray-800/60 dark:bg-gray-900/80">
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    <span>Table des matières</span>
                    <span className="transition-transform group-open:rotate-180">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </span>
                  </summary>
                  <div className="border-t border-gray-200/60 px-5 py-4 dark:border-gray-800/60">
                    <ul className="space-y-2">
                      {sections.map((section, index) => (
                        <li key={section.id}>
                          <a
                            href={`#${section.id}`}
                            className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              {index + 1}
                            </span>
                            {section.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </div>

              {/* Sections with Timeline */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute bottom-0 left-[11px] top-0 w-0.5 bg-gradient-to-b from-gray-200 via-gray-200 to-transparent dark:from-gray-800 dark:via-gray-800" />

                {/* Content */}
                <div className="space-y-0">{children}</div>
              </div>

              {/* Navigation Cards */}
              <LegalNavCards currentPage={pageType} />
            </motion.article>

            {/* Sidebar TOC */}
            <LegalTOC sections={sections} currentPage={pageType} />
          </div>
        </div>
      </div>
    </>
  )
}
