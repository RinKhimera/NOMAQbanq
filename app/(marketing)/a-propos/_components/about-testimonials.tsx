"use client"

import { Star } from "lucide-react"
import TestimonialsCarousel from "@/components/marketing/testimonials-carousel"

export default function AboutTestimonials() {
  return (
    <div className="mb-20">
      <div className="mb-16 text-center">
        <div className="mb-8 inline-flex items-center rounded-full border border-yellow-200/50 bg-linear-to-r from-yellow-100 to-orange-100 px-6 py-3 text-sm font-semibold text-yellow-700 dark:border-yellow-700/50 dark:from-yellow-900/50 dark:to-orange-900/50 dark:text-yellow-300">
          <Star className="mr-2 h-4 w-4" />
          Témoignages
        </div>
        <h2 className="font-display mb-6 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl dark:text-white">
          Ils ont réussi avec NOMAQbanq
        </h2>
        <p className="mx-auto max-w-3xl text-lg leading-relaxed text-gray-600 dark:text-gray-300">
          Des témoignages authentiques de professionnels qui ont réussi grâce à
          NOMAQbanq
        </p>
      </div>
      <div>
        <TestimonialsCarousel />
      </div>
    </div>
  )
}
