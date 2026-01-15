"use client"

import { useState } from "react"
import { FaqHeader } from "./_components/faq-header"
import { FaqSearch } from "./_components/faq-search"
import { FaqCategories } from "./_components/faq-categories"
import { FaqCta } from "./_components/faq-cta"

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")

  return (
    <>
      <FaqHeader />
      <FaqSearch
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />
      <FaqCategories searchQuery={searchQuery} activeCategory={activeCategory} />
      <FaqCta />
    </>
  )
}
