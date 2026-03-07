"use client"

import { useState } from "react"
import { FaqCategories } from "./faq-categories"
import { FaqCta } from "./faq-cta"
import { FaqHeader } from "./faq-header"
import { FaqSearch } from "./faq-search"

export default function FaqPageClient() {
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
      <FaqCategories
        searchQuery={searchQuery}
        activeCategory={activeCategory}
      />
      <FaqCta />
    </>
  )
}
