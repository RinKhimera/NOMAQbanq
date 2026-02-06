"use client"

import { useMemo } from "react"
import { motion } from "motion/react"
import { SearchX } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { faqCategories } from "../_data/faq-data"

interface FaqCategoriesProps {
  searchQuery: string
  activeCategory: string
}

export const FaqCategories = ({
  searchQuery,
  activeCategory,
}: FaqCategoriesProps) => {
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return faqCategories
      .filter(
        (category) =>
          activeCategory === "all" || category.id === activeCategory
      )
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (faq) =>
            !query ||
            faq.q.toLowerCase().includes(query) ||
            faq.a.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.questions.length > 0)
  }, [searchQuery, activeCategory])

  const totalResults = filteredCategories.reduce(
    (acc, cat) => acc + cat.questions.length,
    0
  )

  if (filteredCategories.length === 0) {
    return (
      <section className="py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center rounded-2xl bg-gray-50 py-16 dark:bg-gray-800/50"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-200 dark:bg-gray-700">
              <SearchX className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Aucun résultat trouvé
            </h3>
            <p className="text-center text-gray-500 dark:text-gray-400">
              Essayez avec d{"'"}autres termes de recherche ou changez de
              catégorie.
            </p>
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-12">
      {/* Background with depth */}
      <div className="absolute inset-0 bg-linear-to-b from-slate-50 via-white to-blue-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950/30" />

      {/* Subtle animated orbs */}
      <div className="absolute top-20 -left-32 h-64 w-64 rounded-full bg-linear-to-br from-blue-200/40 to-indigo-300/40 blur-3xl dark:from-blue-900/20 dark:to-indigo-900/20" />
      <div className="absolute bottom-40 -right-32 h-72 w-72 rounded-full bg-linear-to-br from-purple-200/40 to-pink-300/40 blur-3xl dark:from-purple-900/20 dark:to-pink-900/20" />
      <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-linear-to-br from-emerald-200/30 to-teal-300/30 blur-3xl dark:from-emerald-900/15 dark:to-teal-900/15" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Results count */}
        {searchQuery && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 text-sm text-gray-500 dark:text-gray-400"
          >
            {totalResults} résultat{totalResults > 1 ? "s" : ""} trouvé
            {totalResults > 1 ? "s" : ""}
          </motion.p>
        )}

        <div className="space-y-10">
          {filteredCategories.map((category, categoryIdx) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: categoryIdx * 0.1 }}
            >
              {/* Category Header */}
              <div className="mb-6 flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br ${category.color} shadow-lg`}
                >
                  <category.icon className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {category.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {category.questions.length} question
                    {category.questions.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Questions Accordion */}
              <Accordion
                type="single"
                collapsible
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                {category.questions.map((faq, faqIdx) => (
                  <AccordionItem
                    key={faqIdx}
                    value={`item-${category.id}-${faqIdx}`}
                    className="border-b border-gray-200 px-6 last:border-b-0 dark:border-gray-800"
                  >
                    <AccordionTrigger className="cursor-pointer py-5 text-left text-base font-semibold text-gray-900 hover:text-blue-600 hover:no-underline dark:text-white dark:hover:text-blue-400">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 text-gray-600 dark:text-gray-400">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
