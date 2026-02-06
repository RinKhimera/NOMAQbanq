"use client"

import Link from "next/link"
import { motion } from "motion/react"
import {
  IconFileText,
  IconShield,
  IconCookie,
  IconArrowRight,
} from "@tabler/icons-react"

type PageType = "conditions" | "confidentialite" | "cookies"

interface LegalNavCardsProps {
  currentPage: PageType
}

const pageConfig: Record<
  PageType,
  {
    label: string
    description: string
    href: string
    icon: typeof IconFileText
    gradient: string
    iconBg: string
  }
> = {
  conditions: {
    label: "Conditions d'utilisation",
    description: "Règles d'utilisation de la plateforme",
    href: "/conditions",
    icon: IconFileText,
    gradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-blue-500",
  },
  confidentialite: {
    label: "Politique de confidentialité",
    description: "Protection de vos données personnelles",
    href: "/confidentialite",
    icon: IconShield,
    gradient: "from-violet-500 to-purple-600",
    iconBg: "bg-violet-500",
  },
  cookies: {
    label: "Politique de cookies",
    description: "Gestion des traceurs et cookies",
    href: "/cookies",
    icon: IconCookie,
    gradient: "from-amber-500 to-orange-600",
    iconBg: "bg-amber-500",
  },
}

export const LegalNavCards = ({ currentPage }: LegalNavCardsProps) => {
  const otherPages = (Object.keys(pageConfig) as PageType[]).filter(
    (page) => page !== currentPage
  )

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="mt-20 border-t border-gray-200 pt-12 dark:border-gray-800"
    >
      <h2 className="mb-8 text-center text-lg font-medium text-gray-600 dark:text-gray-400">
        Consultez également nos autres documents légaux
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {otherPages.map((page, index) => {
          const config = pageConfig[page]
          const Icon = config.icon
          return (
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link
                href={config.href}
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-gray-800/60 dark:bg-gray-900"
              >
                {/* Icon */}
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${config.gradient} text-white shadow-lg`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                    {config.label}
                  </h3>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    {config.description}
                  </p>
                </div>

                {/* Arrow */}
                <IconArrowRight className="h-5 w-5 text-gray-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-500 dark:group-hover:text-blue-400" />

                {/* Hover gradient overlay */}
                <div
                  className={`absolute inset-0 bg-linear-to-r ${config.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.03]`}
                />
              </Link>
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}
