"use client"

import { Search, X } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface FaqSearchProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  activeCategory: string
  setActiveCategory: (category: string) => void
}

const categories = [
  { id: "all", label: "Toutes" },
  { id: "plateforme", label: "Plateforme" },
  { id: "tarifs", label: "Tarifs" },
  { id: "contenu", label: "Contenu" },
  { id: "securite", label: "Sécurité" },
  { id: "support", label: "Support" },
]

export const FaqSearch = ({
  searchQuery,
  setSearchQuery,
  activeCategory,
  setActiveCategory,
}: FaqSearchProps) => {
  return (
    <section className="relative -mt-8 pb-8">
      {/* Transitional background - blends header to categories */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-50/50 to-slate-50 dark:from-transparent dark:via-gray-800/50 dark:to-gray-900" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="rounded-2xl bg-white/90 p-6 shadow-xl backdrop-blur-sm dark:bg-gray-800/90"
        >
          {/* Search input */}
          <div className="relative">
            <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher une question..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-14 rounded-xl border-gray-200 bg-gray-50 pr-12 pl-12 text-base placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:placeholder:text-gray-500 dark:focus:border-blue-400 dark:focus:bg-gray-800"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-2 h-10 w-10 -translate-y-1/2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Category filters */}
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                  activeCategory === category.id
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
